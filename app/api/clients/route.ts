import { NextRequest } from "next/server";
import { z } from "zod";
import { applyEmployeeScope, authErrorResponse, employeeRecordFields, requireEmployee } from "@/lib/auth-server";
import { db } from "@/lib/firebase/admin";
import { normalizeBulgarianPhone } from "@/lib/normalizers";

export async function GET(request: NextRequest) {
  try {
    const employee = await requireEmployee(request);
    const snapshot = await applyEmployeeScope(db.collection("clients"), employee)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();
    return Response.json({ clients: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Грешка при зареждане на клиентите." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const employee = await requireEmployee(request);
    const { phone } = z.object({ phone: z.string().min(6) }).parse(await request.json());
    const phoneNormalized = normalizeBulgarianPhone(phone);
    const duplicate = await applyEmployeeScope(db.collection("clients"), employee)
      .where("phoneNormalized", "==", phoneNormalized)
      .limit(1)
      .get();
    if (!duplicate.empty) return Response.json({ error: "Този телефон вече принадлежи на друг клиент." }, { status: 409 });

    const now = new Date().toISOString();
    const ref = db.collection("clients").doc();
    await ref.set({
      ...employeeRecordFields(employee),
      phone: phone.trim(),
      phoneNormalized,
      createdAt: now,
      updatedAt: now,
      updatedBy: employee.uid,
    });
    return Response.json({ id: ref.id }, { status: 201 });
  } catch (error) {
    const auth = authErrorResponse(error); if (auth) return auth;
    if (error instanceof z.ZodError) return Response.json({ error: "Невалиден телефон." }, { status: 400 });
    return Response.json({ error: "Грешка при създаване на клиент." }, { status: 500 });
  }
}
