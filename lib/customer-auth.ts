import { NextRequest } from "next/server";
import { adminAuth, db } from "@/lib/firebase/admin";

export interface CustomerIdentity {
  uid: string;
  email: string;
  clientId: string;
  locationId: string;
}

export async function requireCustomer(request: NextRequest): Promise<CustomerIdentity> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new Error("CUSTOMER_UNAUTHENTICATED");

  let uid: string;
  let tokenEmail = "";
  try {
    const decoded = await adminAuth.verifyIdToken(authorization.slice("Bearer ".length));
    uid = decoded.uid;
    tokenEmail = decoded.email ?? "";
  } catch {
    throw new Error("CUSTOMER_UNAUTHENTICATED");
  }

  const accountSnap = await db.collection("customerAccounts").doc(uid).get();
  const account = accountSnap.data();
  if (
    !accountSnap.exists ||
    account?.active !== true ||
    typeof account.clientId !== "string" ||
    !account.clientId.trim() ||
    typeof account.locationId !== "string" ||
    !account.locationId.trim()
  ) {
    throw new Error("CUSTOMER_FORBIDDEN");
  }

  return {
    uid,
    email: typeof account.email === "string" ? account.email : tokenEmail,
    clientId: account.clientId,
    locationId: account.locationId,
  };
}

export function customerAuthErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "CUSTOMER_UNAUTHENTICATED") {
    return Response.json({ error: "Не сте влезли в клиентския портал." }, { status: 401 });
  }
  if (message === "CUSTOMER_FORBIDDEN") {
    return Response.json({ error: "Нямате активиран клиентски достъп." }, { status: 403 });
  }
  return null;
}
