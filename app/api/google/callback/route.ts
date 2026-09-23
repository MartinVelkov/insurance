import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { makeGoogleOAuthClient } from "@/lib/google-calendar";
import { encryptSecret } from "@/lib/token-crypto";

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  if (!state || !code) return NextResponse.redirect(`${base}/settings/calendar?error=oauth`);

  const stateRef = db.collection("oauthStates").doc(state);
  const stateSnap = await stateRef.get();
  if (!stateSnap.exists || Number(stateSnap.data()?.expiresAtMs ?? 0) < Date.now()) {
    await stateRef.delete().catch(() => undefined);
    return NextResponse.redirect(`${base}/settings/calendar?error=state`);
  }
  const uid = stateSnap.data()!.uid as string;
  const stateLocationId = stateSnap.data()!.locationId as string | undefined;
  await stateRef.delete();

  try {
    const employeeSnap = await db.collection("employees").doc(uid).get();
    const employee = employeeSnap.data();
    if (!employeeSnap.exists || employee?.active !== true || employee.locationId !== stateLocationId) {
      throw new Error("Employee is no longer active.");
    }
    const oauth = makeGoogleOAuthClient();
    const { tokens } = await oauth.getToken(code);
    const existing = await db.collection("googleConnections").doc(uid).get();
    const refreshTokenEncrypted = tokens.refresh_token ? encryptSecret(tokens.refresh_token) : existing.data()?.refreshTokenEncrypted;
    if (!refreshTokenEncrypted) throw new Error("Google не върна refresh token.");
    await db.collection("googleConnections").doc(uid).set({ refreshTokenEncrypted, scope: tokens.scope ?? null, connectedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.redirect(`${base}/settings/calendar?connected=1`);
  } catch {
    return NextResponse.redirect(`${base}/settings/calendar?error=oauth`);
  }
}
