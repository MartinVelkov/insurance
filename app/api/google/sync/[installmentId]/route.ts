import { NextRequest } from "next/server";
import { authErrorResponse, requireEmployee } from "@/lib/auth-server";
import { syncInstallmentToCalendar } from "@/lib/calendar-sync";
import { googleIntegrationErrorResponse } from "@/lib/google-calendar";

export async function POST(request: NextRequest, { params }: { params: Promise<{ installmentId: string }> }) {
  try {
    const employee = await requireEmployee(request);
    const { installmentId } = await params;
    const result = await syncInstallmentToCalendar(installmentId, employee);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return authErrorResponse(error) ?? googleIntegrationErrorResponse(error);
  }
}
