import { NextRequest } from "next/server";
import { applyEmployeeScope, authErrorResponse, requireAccessibleDocument, requireEmployee } from "@/lib/auth-server";
import { db } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  try {
    const employee = await requireEmployee(request);
    let query = applyEmployeeScope(db.collection("installments"), employee);
    const policyId = request.nextUrl.searchParams.get("policyId");
    const clientId = request.nextUrl.searchParams.get("clientId");
    if (policyId) {
      await requireAccessibleDocument("policies", policyId, employee);
      query = query.where("policyId", "==", policyId);
    }
    if (clientId) {
      await requireAccessibleDocument("clients", clientId, employee);
      query = query.where("clientId", "==", clientId);
    }
    const snapshot = await query.orderBy("dueDate", "asc").limit(200).get();
    return Response.json({ installments: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Грешка при зареждане на вноските." }, { status: 500 });
  }
}
