import { NextRequest } from "next/server";
import { authErrorResponse, requireEmployee } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  try {
    const employee = await requireEmployee(request);
    return Response.json({ ok: true, employee });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Грешка при проверка на достъпа." }, { status: 500 });
  }
}
