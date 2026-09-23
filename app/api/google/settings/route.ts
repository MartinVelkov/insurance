import { NextRequest } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireEmployee } from "@/lib/auth-server";
import { db } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  try {
    const identity = await requireEmployee(request);
    const [employee, connection] = await Promise.all([db.collection("employees").doc(identity.uid).get(), db.collection("googleConnections").doc(identity.uid).get()]);
    const settings = employee.data()?.calendarSettings ?? {};
    return Response.json({ connected: connection.exists, calendarId: settings.calendarId, reminderMinutes: settings.reminderMinutes ?? [1440] });
  } catch (error) { return authErrorResponse(error) ?? Response.json({ error: "Грешка при настройките." }, { status: 500 }); }
}

export async function PUT(request: NextRequest) {
  try {
    const employee = await requireEmployee(request);
    const body = z.object({ calendarId: z.string().min(1), reminderMinutes: z.array(z.number().int().min(0).max(40320)).min(1).max(5) }).parse(await request.json());
    await db.collection("employees").doc(employee.uid).set({ calendarSettings: body, updatedAt: new Date().toISOString() }, { merge: true });
    return Response.json({ ok: true });
  } catch (error) {
    const auth = authErrorResponse(error); if (auth) return auth;
    return Response.json({ error: error instanceof Error ? error.message : "Грешка при запазване." }, { status: 400 });
  }
}
