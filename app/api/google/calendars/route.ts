import { NextRequest } from "next/server";
import { authErrorResponse, requireEmployee } from "@/lib/auth-server";
import {
  calendarApi,
  getAuthorizedGoogleClient,
  googleIntegrationErrorResponse,
  isGoogleReauthorizationError,
  markGoogleReauthorizationRequired,
  GoogleIntegrationError,
} from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  try {
    const employee = await requireEmployee(request);
    const calendar = calendarApi(await getAuthorizedGoogleClient(employee.uid));
    const calendars = [];
    let pageToken: string | undefined;
    do {
      const response = await calendar.calendarList.list({
        maxResults: 250,
        minAccessRole: "writer",
        pageToken,
      });
      calendars.push(
        ...(response.data.items ?? [])
          .filter((item) => Boolean(item.id))
          .map((item) => ({
            id: item.id!,
            summary: item.summary ?? item.id!,
            primary: item.primary ?? false,
            accessRole: item.accessRole ?? undefined,
          })),
      );
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
    return Response.json(
      { calendars },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
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
