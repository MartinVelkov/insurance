import { NextRequest } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireEmployee } from "@/lib/auth-server";
import { db } from "@/lib/firebase/admin";
import {
  calendarApi,
  getAuthorizedGoogleClient,
  getGoogleConnection,
  GoogleIntegrationError,
  googleIntegrationErrorResponse,
  isGoogleReauthorizationError,
  markGoogleReauthorizationRequired,
} from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  try {
    const identity = await requireEmployee(request);
    const [employee, connection] = await Promise.all([
      db.collection("employees").doc(identity.uid).get(),
      getGoogleConnection(identity.uid),
    ]);
    const legacySettings = employee.data()?.calendarSettings ?? {};
    return Response.json(
      {
        connected: connection.connected,
        requiresReconnect: connection.requiresReconnect,
        calendarId: connection.data?.calendarId ?? legacySettings.calendarId,
        reminderMinutes:
          connection.data?.reminderMinutes ??
          legacySettings.reminderMinutes ??
          [1440],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) { return authErrorResponse(error) ?? Response.json({ error: "Грешка при настройките." }, { status: 500 }); }
}

export async function PUT(request: NextRequest) {
  try {
    const employee = await requireEmployee(request);
    const body = z.object({ calendarId: z.string().min(1), reminderMinutes: z.array(z.number().int().min(0).max(40320)).min(1).max(5) }).parse(await request.json());
    const [connectionBefore, employeeBefore] = await Promise.all([
      getGoogleConnection(employee.uid),
      db.collection("employees").doc(employee.uid).get(),
    ]);
    const calendar = calendarApi(await getAuthorizedGoogleClient(employee.uid));
    const selected = await calendar.calendarList.get({ calendarId: body.calendarId });
    if (!["owner", "writer"].includes(selected.data.accessRole ?? "")) {
      return Response.json(
        { error: "Избраният календар няма право за запис." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const oldCalendarId =
      connectionBefore.data?.calendarId ??
      employeeBefore.data()?.calendarSettings?.calendarId;
    const batch = db.batch();
    batch.set(
      db.collection("googleConnections").doc(employee.uid),
      {
        ...body,
        ...(oldCalendarId && oldCalendarId !== body.calendarId
          ? { previousCalendarId: oldCalendarId }
          : {}),
        updatedAt: now,
      },
      { merge: true },
    );
    // Keep the legacy field in sync while existing deployments migrate.
    batch.set(
      db.collection("employees").doc(employee.uid),
      { calendarSettings: body, updatedAt: now },
      { merge: true },
    );
    await batch.commit();
    return Response.json({ ok: true });
  } catch (error) {
    const auth = authErrorResponse(error); if (auth) return auth;
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Невалидни календарни настройки." }, { status: 400 });
    }
    if (isGoogleReauthorizationError(error)) {
      const employee = await requireEmployee(request).catch(() => null);
      if (employee) await markGoogleReauthorizationRequired(employee.uid);
      return googleIntegrationErrorResponse(
        new GoogleIntegrationError(
          "REAUTHORIZATION_REQUIRED",
          "Google достъпът е изтекъл или е отнет. Свържете акаунта отново.",
          409,
        ),
      );
    }
    return googleIntegrationErrorResponse(error);
  }
}
