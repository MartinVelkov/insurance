import { NextRequest } from "next/server";
import { applyEmployeeScope, authErrorResponse, requireAccessibleDocument, requireEmployee } from "@/lib/auth-server";
import { db } from "@/lib/firebase/admin";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { addIsoDays, todayInSofia } from "@/lib/time";

export async function GET(request: NextRequest) {
  try {
    const employee = await requireEmployee(request);
    const today = todayInSofia();
    const requestedDays = Number(request.nextUrl.searchParams.get("days") ?? 30);
    const days = [7, 30, 60, 90].includes(requestedDays) ? requestedDays : 30;
    const in30 = addIsoDays(today, days);
    const vehicleExpiryLimit = addIsoDays(today, 30);

    const [upcomingSnap, overdueSnap, expiringSnap, expiringGtpSnap, expiringVignetteSnap] = await Promise.all([
      applyEmployeeScope(db.collection("installments"), employee).where("paymentStatus", "==", "pending").where("dueDate", ">=", today).where("dueDate", "<=", in30).orderBy("dueDate", "asc").limit(100).get(),
      applyEmployeeScope(db.collection("installments"), employee).where("paymentStatus", "==", "pending").where("dueDate", "<", today).orderBy("dueDate", "asc").limit(100).get(),
      applyEmployeeScope(db.collection("policies"), employee).where("endDate", ">=", today).where("endDate", "<=", in30).orderBy("endDate", "asc").limit(100).get(),
      applyEmployeeScope(db.collection("vehicles"), employee).where("gtpEndDate", ">=", today).where("gtpEndDate", "<=", vehicleExpiryLimit).orderBy("gtpEndDate", "asc").limit(100).get(),
      applyEmployeeScope(db.collection("vehicles"), employee).where("vignetteEndDate", ">=", today).where("vignetteEndDate", "<=", vehicleExpiryLimit).orderBy("vignetteEndDate", "asc").limit(100).get(),
    ]);

    const installmentRows = [...upcomingSnap.docs, ...overdueSnap.docs];
    const policyIds = [...new Set(installmentRows.map((d) => d.data().policyId as string))];
    const clientIds = [...new Set([
      ...installmentRows.map((d) => d.data().clientId as string),
      ...expiringSnap.docs.map((d) => d.data().clientId as string),
      ...expiringGtpSnap.docs.map((d) => d.data().clientId as string),
      ...expiringVignetteSnap.docs.map((d) => d.data().clientId as string),
    ])];
    const vehicleIds = [...new Set([...installmentRows.map((d) => d.data().vehicleId as string), ...expiringSnap.docs.map((d) => d.data().vehicleId as string)])];

    const [policyDocs, clientDocs, vehicleDocs] = await Promise.all([
      Promise.all(policyIds.map((id) => requireAccessibleDocument("policies", id, employee))),
      Promise.all(clientIds.map((id) => requireAccessibleDocument("clients", id, employee))),
      Promise.all(vehicleIds.map((id) => requireAccessibleDocument("vehicles", id, employee))),
    ]);
    const policyMap = new Map(policyDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!]));
    const clientMap = new Map(clientDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!]));
    const vehicleMap = new Map(vehicleDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!]));

    const enrich = (doc: QueryDocumentSnapshot) => {
      const i = doc.data(); const p = policyMap.get(i.policyId); const c = clientMap.get(i.clientId); const v = vehicleMap.get(i.vehicleId);
      return { id: doc.id, dueDate: i.dueDate, amount: i.amount, currency: i.currency, sequence: i.sequence, totalCount: i.totalCount, clientPhone: c?.phone ?? "—", registrationNumber: v?.registrationNumber ?? "—", policyNumber: p?.policyNumber ?? "—" };
    };

    const expiring = expiringSnap.docs.map((doc) => { const p = doc.data(); return { id: doc.id, endDate: p.endDate, policyNumber: p.policyNumber, registrationNumber: vehicleMap.get(p.vehicleId)?.registrationNumber ?? "—", clientPhone: clientMap.get(p.clientId)?.phone ?? "—" }; });
    const expiringVehicleRows = (docs: QueryDocumentSnapshot[], endDateField: "gtpEndDate" | "vignetteEndDate") => docs.map((doc) => {
      const vehicle = doc.data();
      return { id: doc.id, endDate: vehicle[endDateField], registrationNumber: vehicle.registrationNumber, clientPhone: clientMap.get(vehicle.clientId)?.phone ?? "—" };
    });

    return Response.json({
      upcoming: upcomingSnap.docs.map(enrich),
      overdue: overdueSnap.docs.map(enrich),
      expiring,
      expiringGtp: expiringVehicleRows(expiringGtpSnap.docs, "gtpEndDate"),
      expiringVignettes: expiringVehicleRows(expiringVignetteSnap.docs, "vignetteEndDate"),
    });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: error instanceof Error ? error.message : "Грешка при зареждане на таблото." }, { status: 500 });
  }
}
