import { NextRequest } from "next/server";
import { z } from "zod";
import { applyEmployeeScope, authErrorResponse, employeeRecordFields, requireAccessibleDocument, requireEmployee } from "@/lib/auth-server";
import { db } from "@/lib/firebase/admin";
import { normalizeRegistrationNumber } from "@/lib/normalizers";

export async function GET(request: NextRequest) {
  try {
    const employee = await requireEmployee(request);
    let query = applyEmployeeScope(db.collection("vehicles"), employee);
    const clientId = request.nextUrl.searchParams.get("clientId");
    if (clientId) {
      await requireAccessibleDocument("clients", clientId, employee);
      query = query.where("clientId", "==", clientId);
    }
    const snapshot = await query.limit(200).get();
    return Response.json({ vehicles: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Грешка при зареждане на автомобилите." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const employee = await requireEmployee(request);
    const body = z.object({ clientId: z.string().min(1), registrationNumber: z.string().min(3) }).parse(await request.json());
    await requireAccessibleDocument("clients", body.clientId, employee);
    const normalizedRegistrationNumber = normalizeRegistrationNumber(body.registrationNumber);
    const duplicate = await applyEmployeeScope(db.collection("vehicles"), employee)
      .where("clientId", "==", body.clientId)
      .where("normalizedRegistrationNumber", "==", normalizedRegistrationNumber)
      .limit(1)
      .get();
    if (!duplicate.empty) return Response.json({ error: "Автомобилът вече съществува." }, { status: 409 });
    const now = new Date().toISOString();
    const ref = db.collection("vehicles").doc();
    await ref.set({ ...employeeRecordFields(employee), clientId: body.clientId, registrationNumber: body.registrationNumber.trim().toUpperCase(), normalizedRegistrationNumber, createdAt: now, updatedAt: now, updatedBy: employee.uid });
    return Response.json({ id: ref.id }, { status: 201 });
  } catch (error) {
    const auth = authErrorResponse(error); if (auth) return auth;
    if (error instanceof z.ZodError) return Response.json({ error: "Невалидни данни за автомобила." }, { status: 400 });
    return Response.json({ error: "Грешка при създаване на автомобил." }, { status: 500 });
  }
}
