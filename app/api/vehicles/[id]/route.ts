import { NextRequest } from "next/server";
import { authErrorResponse, requireAccessibleDocument, requireEmployee } from "@/lib/auth-server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const employee = await requireEmployee(request);
    const { id } = await params;
    const vehicle = await requireAccessibleDocument("vehicles", id, employee);
    return Response.json({ vehicle: { id: vehicle.id, ...vehicle.data() } });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Грешка при зареждане на автомобила." }, { status: 500 });
  }
}
