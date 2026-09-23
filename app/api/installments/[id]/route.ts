import { NextRequest } from "next/server";
import { z } from "zod";
import { authErrorResponse, employeeRecordFields, requireAccessibleDocument, requireEmployee } from "@/lib/auth-server";
import { db } from "@/lib/firebase/admin";
import { syncInstallmentToCalendar } from "@/lib/calendar-sync";

const schema = z.object({
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const employee = await requireEmployee(request);
    const { id } = await params;
    const installment = await requireAccessibleDocument("installments", id, employee);
    return Response.json({ installment: { id: installment.id, ...installment.data() } });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Грешка при зареждане на вноската." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const employee = await requireEmployee(request);
    const { id } = await params;
    const { dueDate } = schema.parse(await request.json());
    const ref = db.collection("installments").doc(id);
    const snap = await requireAccessibleDocument("installments", id, employee);

    const before = snap.data()!;
    const now = new Date().toISOString();
    const batch = db.batch();
    batch.update(ref, { dueDate, updatedAt: now, updatedBy: employee.uid, calendarSyncStatus: "not_synced" });
    batch.set(db.collection("auditLogs").doc(), {
      ...employeeRecordFields(employee),
      actorUid: employee.uid,
      actorEmail: employee.email,
      action: "Променен падеж",
      entityType: "installment",
      entityId: id,
      subjectClientId: before.clientId,
      before: { dueDate: before.dueDate },
      after: { dueDate },
      createdAt: now,
    });
    await batch.commit();

    try { await syncInstallmentToCalendar(id, employee); } catch { /* edit remains saved */ }
    return Response.json({ ok: true });
  } catch (error) {
    const auth = authErrorResponse(error); if (auth) return auth;
    if (error instanceof z.ZodError) return Response.json({ error: "Невалидна дата." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Грешка при редакция." }, { status: 500 });
  }
}
