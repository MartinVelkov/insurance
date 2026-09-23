import { NextRequest } from "next/server";
import { z } from "zod";
import { authErrorResponse, employeeRecordFields, requireAccessibleDocument, requireEmployee } from "@/lib/auth-server";
import { db } from "@/lib/firebase/admin";
import { syncInstallmentToCalendar } from "@/lib/calendar-sync";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const employee = await requireEmployee(request);
    const { id } = await params;
    const { paid } = z.object({ paid: z.boolean() }).parse(await request.json());
    const ref = db.collection("installments").doc(id);
    const snap = await requireAccessibleDocument("installments", id, employee);
    const before = snap.data()!;
    const now = new Date().toISOString();
    const after = { paymentStatus: paid ? "paid" : "pending", paidAt: paid ? now : null, updatedAt: now, updatedBy: employee.uid };
    const batch = db.batch();
    batch.update(ref, after);
    const audit = db.collection("auditLogs").doc();
    batch.set(audit, { ...employeeRecordFields(employee), actorUid: employee.uid, actorEmail: employee.email, action: paid ? "Отбелязана платена вноска" : "Отменено плащане", entityType: "installment", entityId: id, subjectClientId: before.clientId, before: { paymentStatus: before.paymentStatus, paidAt: before.paidAt ?? null }, after, createdAt: now });
    await batch.commit();
    try { await syncInstallmentToCalendar(id, employee); } catch { /* payment remains saved */ }
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: error instanceof Error ? error.message : "Грешка при плащане." }, { status: 500 });
  }
}
