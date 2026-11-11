import { NextRequest } from "next/server";
import { z } from "zod";
import { applyEmployeeScope, authErrorResponse, employeeRecordFields, requireEmployee } from "@/lib/auth-server";
import { db } from "@/lib/firebase/admin";
import { normalizeBulgarianPhone, normalizePolicyNumber, normalizeRegistrationNumber } from "@/lib/normalizers";
import { sumInstallments } from "@/lib/installments";
import { syncInstallmentToCalendar } from "@/lib/calendar-sync";
import { getOneYearEndDate } from "@/lib/time";

const optionalIsoDate = z.union([
  z.literal(""),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => Boolean(getOneYearEndDate(value))),
]).optional().default("");

const installmentSchema = z.object({
  sequence: z.number().int().positive(),
  totalCount: z.number().int().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive(),
  currency: z.enum(["EUR", "BGN"]),
});
const schema = z.object({
  phone: z.string().min(6),
  registrationNumber: z.string().min(3),
  gtpStartDate: optionalIsoDate,
  vignetteStartDate: optionalIsoDate,
  registrationCertificateNumber: z.string().trim().max(100).optional().default(""),
  policyNumber: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalAmount: z.number().positive(),
  currency: z.enum(["EUR", "BGN"]),
  installmentCount: z.number().int().min(1).max(24),
  periodMonths: z.number().int().min(1).max(24),
  installments: z.array(installmentSchema).min(1).max(24),
});

export async function GET(request: NextRequest) {
  try {
    const employee = await requireEmployee(request);
    const snapshot = await applyEmployeeScope(db.collection("policies"), employee)
      .orderBy("startDate", "desc")
      .limit(200)
      .get();
    return Response.json({ policies: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Грешка при зареждане на полиците." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const employee = await requireEmployee(request);
    const data = schema.parse(await request.json());
    const policyEndDate = getOneYearEndDate(data.startDate);
    if (!policyEndDate || data.endDate !== policyEndDate) return Response.json({ error: "Невалидна крайна дата на полицата." }, { status: 400 });
    if (data.installments.length !== data.installmentCount) return Response.json({ error: "Броят на вноските не съвпада." }, { status: 400 });
    if (Math.abs(sumInstallments(data.installments) - data.totalAmount) > 0.001) return Response.json({ error: "Сборът на вноските не съвпада с общата стойност." }, { status: 400 });

    const normalizedPhone = normalizeBulgarianPhone(data.phone);
    const normalizedRegistrationNumber = normalizeRegistrationNumber(data.registrationNumber);
    const normalizedPolicyNumber = normalizePolicyNumber(data.policyNumber);
    const vehicleDetails: Record<string, string> = {};
    if (data.gtpStartDate) {
      vehicleDetails.gtpStartDate = data.gtpStartDate;
      vehicleDetails.gtpEndDate = getOneYearEndDate(data.gtpStartDate);
    }
    if (data.vignetteStartDate) {
      vehicleDetails.vignetteStartDate = data.vignetteStartDate;
      vehicleDetails.vignetteEndDate = getOneYearEndDate(data.vignetteStartDate);
    }
    if (data.registrationCertificateNumber) {
      vehicleDetails.registrationCertificateNumber = data.registrationCertificateNumber;
    }
    const duplicatePolicy = await db.collection("policies").where("locationId", "==", employee.locationId).where("policyNumberNormalized", "==", normalizedPolicyNumber).limit(1).get();
    if (!duplicatePolicy.empty) return Response.json({ error: "Вече съществува полица с този номер." }, { status: 409 });

    const now = new Date().toISOString();
    let clientId: string;
    const existingClient = await applyEmployeeScope(db.collection("clients"), employee).where("phoneNormalized", "==", normalizedPhone).limit(1).get();
    if (existingClient.empty) {
      const ref = db.collection("clients").doc(); clientId = ref.id;
      await ref.set({ ...employeeRecordFields(employee), phone: data.phone.trim(), phoneNormalized: normalizedPhone, createdAt: now, updatedAt: now, updatedBy: employee.uid });
    } else {
      clientId = existingClient.docs[0].id;
      await db.collection("clients").doc(clientId).update({ phone: data.phone.trim(), phoneNormalized: normalizedPhone, updatedAt: now, updatedBy: employee.uid });
    }

    let vehicleId: string;
    const existingVehicle = await applyEmployeeScope(db.collection("vehicles"), employee).where("clientId", "==", clientId).where("normalizedRegistrationNumber", "==", normalizedRegistrationNumber).limit(1).get();
    if (existingVehicle.empty) {
      const ref = db.collection("vehicles").doc(); vehicleId = ref.id;
      await ref.set({ ...employeeRecordFields(employee), clientId, registrationNumber: data.registrationNumber.trim().toUpperCase(), normalizedRegistrationNumber, ...vehicleDetails, createdAt: now, updatedAt: now, updatedBy: employee.uid });
    } else {
      vehicleId = existingVehicle.docs[0].id;
      if (Object.keys(vehicleDetails).length > 0) {
        await db.collection("vehicles").doc(vehicleId).update({ ...vehicleDetails, updatedAt: now, updatedBy: employee.uid });
      }
    }

    const policyRef = db.collection("policies").doc();
    await policyRef.set({ ...employeeRecordFields(employee), clientId, vehicleId, policyNumber: data.policyNumber.trim(), policyNumberNormalized: normalizedPolicyNumber, startDate: data.startDate, endDate: data.endDate, totalAmount: data.totalAmount, currency: data.currency, installmentCount: data.installmentCount, periodMonths: data.periodMonths, createdAt: now, updatedAt: now, updatedBy: employee.uid });

    const batch = db.batch();
    const installmentIds: string[] = [];
    for (const item of data.installments) {
      const ref = db.collection("installments").doc(); installmentIds.push(ref.id);
      batch.set(ref, { ...employeeRecordFields(employee), policyId: policyRef.id, clientId, vehicleId, sequence: item.sequence, totalCount: item.totalCount, dueDate: item.dueDate, amount: item.amount, currency: item.currency, paymentStatus: "pending", paidAt: null, googleEventId: null, googleCalendarId: null, calendarSyncStatus: "not_synced", calendarSyncError: null, createdAt: now, updatedAt: now, updatedBy: employee.uid });
    }
    const auditRef = db.collection("auditLogs").doc();
    batch.set(auditRef, { ...employeeRecordFields(employee), actorUid: employee.uid, actorEmail: employee.email, action: "Създадена полица", entityType: "policy", entityId: policyRef.id, subjectClientId: clientId, after: { policyNumber: data.policyNumber, registrationNumber: data.registrationNumber, totalAmount: data.totalAmount, currency: data.currency }, createdAt: now });
    await batch.commit();

    let synced = 0; let failed = 0;
    const [connectionSnap, employeeSnap] = await Promise.all([
      db.collection("googleConnections").doc(employee.uid).get(),
      db.collection("employees").doc(employee.uid).get(),
    ]);
    const canSync =
      connectionSnap.exists &&
      connectionSnap.data()?.reauthorizationRequired !== true &&
      Boolean(
        connectionSnap.data()?.calendarId ??
          employeeSnap.data()?.calendarSettings?.calendarId,
      );
    if (canSync) {
      for (const id of installmentIds) {
        try { await syncInstallmentToCalendar(id, employee); synced++; }
        catch { failed++; }
      }
    }

    return Response.json({ policyId: policyRef.id, clientId, calendar: { synced, failed, skipped: canSync ? 0 : installmentIds.length } }, { status: 201 });
  } catch (error) {
    const auth = authErrorResponse(error); if (auth) return auth;
    if (error instanceof z.ZodError) return Response.json({ error: "Невалидни данни за полицата.", details: (error as z.ZodError).issues }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Грешка при създаване на полица." }, { status: 500 });
  }
}
