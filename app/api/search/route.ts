import { NextRequest } from "next/server";
import { applyEmployeeScope, authErrorResponse, requireAccessibleDocument, requireEmployee } from "@/lib/auth-server";
import { db } from "@/lib/firebase/admin";
import { normalizeBulgarianPhone, normalizePolicyNumber, normalizeRegistrationNumber } from "@/lib/normalizers";

export async function GET(request: NextRequest) {
  try {
    const employee = await requireEmployee(request);
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 4) return Response.json({ results: [] });

    const phone = normalizeBulgarianPhone(q);
    const plate = normalizeRegistrationNumber(q);
    const policy = normalizePolicyNumber(q);

    const [clientsSnap, vehiclesSnap, policiesSnap] = await Promise.all([
      applyEmployeeScope(db.collection("clients"), employee).where("phoneNormalized", "==", phone).limit(10).get(),
      applyEmployeeScope(db.collection("vehicles"), employee).where("normalizedRegistrationNumber", "==", plate).limit(10).get(),
      applyEmployeeScope(db.collection("policies"), employee).where("policyNumberNormalized", "==", policy).limit(10).get(),
    ]);

    const resultMap = new Map<string, { clientId: string; phone: string; matchedBy: string; registrationNumber?: string; policyNumber?: string }>();
    for (const d of clientsSnap.docs) resultMap.set(`phone:${d.id}`, { clientId: d.id, phone: d.data().phone, matchedBy: "phone" });

    for (const v of vehiclesSnap.docs) {
      const client = await requireAccessibleDocument("clients", v.data().clientId, employee);
      if (client.exists) resultMap.set(`vehicle:${v.id}`, { clientId: client.id, phone: client.data()!.phone, matchedBy: "registration", registrationNumber: v.data().registrationNumber });
    }
    for (const p of policiesSnap.docs) {
      const client = await requireAccessibleDocument("clients", p.data().clientId, employee);
      if (client.exists) resultMap.set(`policy:${p.id}`, { clientId: client.id, phone: client.data()!.phone, matchedBy: "policy", policyNumber: p.data().policyNumber });
    }
    return Response.json({ results: [...resultMap.values()] });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Грешка при търсене." }, { status: 500 });
  }
}
