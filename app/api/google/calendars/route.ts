import { NextRequest } from "next/server";
import { authErrorResponse, requireEmployee } from "@/lib/auth-server";
import { calendarApi, getAuthorizedGoogleClient } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  try {
    const employee = await requireEmployee(request);
    const calendar = calendarApi(await getAuthorizedGoogleClient(employee.uid));
    const response = await calendar.calendarList.list({ maxResults: 250 });
    const calendars = (response.data.items ?? []).map((c) => ({ id: c.id!, summary: c.summary ?? c.id!, primary: c.primary ?? false, accessRole: c.accessRole ?? undefined }));
    return Response.json({ calendars });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: error instanceof Error ? error.message : "Грешка при календарите." }, { status: 500 });
  }
}
