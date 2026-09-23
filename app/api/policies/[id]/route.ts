import { NextRequest } from "next/server";
import { authErrorResponse, requireAccessibleDocument, requireEmployee } from "@/lib/auth-server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const employee = await requireEmployee(request);
    const { id } = await params;
    const policy = await requireAccessibleDocument("policies", id, employee);
    const data = policy.data()!;
    const [client, vehicle] = await Promise.all([
      requireAccessibleDocument("clients", data.clientId, employee),
      requireAccessibleDocument("vehicles", data.vehicleId, employee),
    ]);
    return Response.json({
      policy: { id: policy.id, ...data },
      client: { id: client.id, ...client.data() },
      vehicle: { id: vehicle.id, ...vehicle.data() },
    });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Грешка при зареждане на полицата." }, { status: 500 });
  }
}
