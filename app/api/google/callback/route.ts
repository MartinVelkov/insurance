import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import {
  GOOGLE_SCOPES,
  getGoogleOAuthConfig,
  googleSettingsUrl,
  makeGoogleOAuthClient,
} from "@/lib/google-calendar";
import { encryptSecret } from "@/lib/token-crypto";

export async function GET(request: NextRequest) {
  try {
    getGoogleOAuthConfig();
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Невалидна OAuth конфигурация." },
      { status: 500 },
    );
  }

  const oauthError = request.nextUrl.searchParams.get("error");
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  if (!state || !/^[a-f0-9]{64}$/.test(state)) {
    return NextResponse.redirect(googleSettingsUrl("invalid_request"));
  }

  const stateRef = db.collection("oauthStates").doc(state);

  try {
    const stateData = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(stateRef);
      if (!snapshot.exists) return null;
      transaction.delete(stateRef);
      const data = snapshot.data();
      if (
        Number(data?.expiresAtMs ?? 0) < Date.now() ||
        typeof data?.uid !== "string" ||
        typeof data?.locationId !== "string" ||
        data?.redirectUri !== getGoogleOAuthConfig().redirectUri
      ) {
        return null;
      }
      return { uid: data.uid as string, locationId: data.locationId as string };
    });
    if (!stateData) return NextResponse.redirect(googleSettingsUrl("state"));
    if (oauthError) {
      return NextResponse.redirect(
        googleSettingsUrl(
          oauthError === "access_denied" ? "denied" : "oauth_error",
        ),
      );
    }
    if (!code) {
      return NextResponse.redirect(googleSettingsUrl("invalid_request"));
    }

    const { uid, locationId: stateLocationId } = stateData;
    const employeeSnap = await db.collection("employees").doc(uid).get();
    const employee = employeeSnap.data();
    if (
      !employeeSnap.exists ||
      employee?.active !== true ||
      employee.locationId !== stateLocationId ||
      !["employee", "owner"].includes(employee.role)
    ) {
      throw new Error("Employee is no longer active.");
    }
    const oauth = makeGoogleOAuthClient();
    const { tokens } = await oauth.getToken(code);
    const grantedScopes = new Set((tokens.scope ?? "").split(/\s+/).filter(Boolean));
    if (tokens.scope && GOOGLE_SCOPES.some((scope) => !grantedScopes.has(scope))) {
      return NextResponse.redirect(googleSettingsUrl("missing_scopes"));
    }

    const connectionRef = db.collection("googleConnections").doc(uid);
    const existing = await connectionRef.get();
    const refreshTokenEncrypted = tokens.refresh_token ? encryptSecret(tokens.refresh_token) : existing.data()?.refreshTokenEncrypted;
    if (!refreshTokenEncrypted) throw new Error("Google не върна refresh token.");
    const now = new Date().toISOString();
    await connectionRef.set(
      {
        refreshTokenEncrypted,
        scope: tokens.scope ?? existing.data()?.scope ?? null,
        connected: true,
        reauthorizationRequired: false,
        lastErrorCode: null,
        connectedAt: existing.data()?.connectedAt ?? now,
        lastConnectedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    return NextResponse.redirect(googleSettingsUrl("connected"));
  } catch {
    return NextResponse.redirect(googleSettingsUrl("oauth_error"));
  }
}
