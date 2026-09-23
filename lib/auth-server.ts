import { NextRequest } from "next/server";
import type { DocumentData, DocumentSnapshot, Query } from "firebase-admin/firestore";
import { adminAuth, db } from "@/lib/firebase/admin";

export type EmployeeRole = "employee" | "owner";

export interface EmployeeIdentity {
  uid: string;
  email: string;
  role: EmployeeRole;
  locationId: string;
  active: true;
}

export async function requireEmployee(request: NextRequest): Promise<EmployeeIdentity> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new Error("UNAUTHENTICATED");

  const token = authorization.slice("Bearer ".length);
  const decoded = await adminAuth.verifyIdToken(token);
  const employeeSnap = await db.collection("employees").doc(decoded.uid).get();
  const data = employeeSnap.data();

  if (
    !employeeSnap.exists ||
    data?.active !== true ||
    (data.role !== "employee" && data.role !== "owner") ||
    typeof data.locationId !== "string" ||
    !data.locationId.trim()
  ) {
    throw new Error("FORBIDDEN");
  }

  return {
    uid: decoded.uid,
    email: typeof data.email === "string" ? data.email : decoded.email ?? "",
    role: data.role,
    locationId: data.locationId,
    active: true,
  };
}

/** Adds both the location boundary and, for employees, the record-owner boundary. */
export function applyEmployeeScope<T extends DocumentData>(query: Query<T>, employee: EmployeeIdentity): Query<T> {
  let scoped = query.where("locationId", "==", employee.locationId);
  if (employee.role === "employee") scoped = scoped.where("employeeId", "==", employee.uid);
  return scoped;
}

export function canAccessRecord(employee: EmployeeIdentity, data: DocumentData | undefined): boolean {
  if (!data || data.locationId !== employee.locationId) return false;
  return employee.role === "owner" || data.employeeId === employee.uid;
}

export const canAccessClient = canAccessRecord;
export const canAccessPolicy = canAccessRecord;
export const canAccessInstallment = canAccessRecord;
export const canAccessVehicle = canAccessRecord;

export async function requireAccessibleDocument(
  collection: "clients" | "vehicles" | "policies" | "installments" | "auditLogs",
  id: string,
  employee: EmployeeIdentity,
): Promise<DocumentSnapshot> {
  const snap = await db.collection(collection).doc(id).get();
  if (!snap.exists) throw new Error("NOT_FOUND");
  if (!canAccessRecord(employee, snap.data())) throw new Error("FORBIDDEN");
  return snap;
}

/** Server-controlled fields for operational records. */
export function employeeRecordFields(employee: EmployeeIdentity) {
  return { locationId: employee.locationId, employeeId: employee.uid, createdBy: employee.uid };
}

export function authErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHENTICATED") {
    return Response.json({ error: "Не сте влезли в системата." }, { status: 401 });
  }
  if (message === "FORBIDDEN") {
    return Response.json({ error: "Нямате разрешение за достъп." }, { status: 403 });
  }
  if (message === "NOT_FOUND") {
    return Response.json({ error: "Записът не е намерен." }, { status: 404 });
  }
  return null;
}
