import { NextRequest } from "next/server";
import { applyEmployeeScope, authErrorResponse, employeeRecordFields, requireAccessibleDocument, requireEmployee } from "@/lib/auth-server";
import { db } from "@/lib/firebase/admin";
import { z } from "zod";
import { normalizeBulgarianPhone } from "@/lib/normalizers";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

const updateClientSchema = z.object({
  phone: z.string().min(6).optional(),
  email: z.union([z.literal(""), z.string().email()]).optional(),
}).refine((data) => data.phone !== undefined || data.email !== undefined);

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const employee = await requireEmployee(request);
    const { id } = await params;
    const clientSnap = await requireAccessibleDocument("clients", id, employee);
    const [vehiclesSnap, policiesSnap, installmentsSnap, auditSnap] = await Promise.all([
      applyEmployeeScope(db.collection("vehicles"), employee).where("clientId", "==", id).get(),
      applyEmployeeScope(db.collection("policies"), employee).where("clientId", "==", id).orderBy("startDate", "desc").get(),
      applyEmployeeScope(db.collection("installments"), employee).where("clientId", "==", id).orderBy("dueDate", "asc").get(),
      applyEmployeeScope(db.collection("auditLogs"), employee).where("subjectClientId", "==", id).orderBy("createdAt", "desc").limit(100).get(),
    ]);
    const withId = (d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() });
    return Response.json({ client: { id: clientSnap.id, ...clientSnap.data() }, vehicles: vehiclesSnap.docs.map(withId), policies: policiesSnap.docs.map(withId), installments: installmentsSnap.docs.map(withId), auditLogs: auditSnap.docs.map(withId) });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: error instanceof Error ? error.message : "Грешка при зареждане на досието." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const employee = await requireEmployee(request);
    const { id } = await params;
    const data = updateClientSchema.parse(await request.json());
    const ref = db.collection("clients").doc(id);
    const snap = await requireAccessibleDocument("clients", id, employee);
    const normalizedPhone = data.phone ? normalizeBulgarianPhone(data.phone) : undefined;
    if (normalizedPhone) {
      const duplicate = await applyEmployeeScope(db.collection("clients"), employee).where("phoneNormalized", "==", normalizedPhone).limit(2).get();
      if (duplicate.docs.some((d) => d.id !== id)) return Response.json({ error: "Този телефон вече принадлежи на друг клиент." }, { status: 409 });
    }
    const now = new Date().toISOString();
    const before = snap.data()!;
    const batch = db.batch();
    const updates: Record<string, unknown> = { updatedAt: now, updatedBy: employee.uid };
    if (data.phone) {
      updates.phone = data.phone.trim();
      updates.phoneNormalized = normalizedPhone;
    }
    if (data.email !== undefined) updates.email = data.email ? data.email.trim().toLowerCase() : FieldValue.delete();
    batch.update(ref, updates);
    batch.set(db.collection("auditLogs").doc(), {
      ...employeeRecordFields(employee), actorUid: employee.uid, actorEmail: employee.email, action: data.phone !== undefined ? "Променени данни на клиент" : "Променен email", entityType: "client", entityId: id, subjectClientId: id, before: { phone: before.phone, email: before.email ?? null }, after: { phone: data.phone?.trim() ?? before.phone, email: data.email === undefined ? before.email ?? null : data.email || null }, createdAt: now
    });
    await batch.commit();
    return Response.json({ ok: true });
  } catch (error) {
    const auth = authErrorResponse(error); if (auth) return auth;
    if (error instanceof z.ZodError) return Response.json({ error: "Невалидни клиентски данни." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Грешка при редакция на клиент." }, { status: 500 });
  }
}
