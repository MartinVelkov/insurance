import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { authErrorResponse, requireEmployee } from "@/lib/auth-server";
import { db } from "@/lib/firebase/admin";
import {
  GOOGLE_SCOPES,
  getGoogleOAuthConfig,
  googleIntegrationErrorResponse,
  makeGoogleOAuthClient,
} from "@/lib/google-calendar";
import { decryptSecret } from "@/lib/token-crypto";

export async function POST(request: NextRequest) {
  try {
    const employee = await requireEmployee(request);
    const state = crypto.randomBytes(32).toString("hex");
    const { redirectUri } = getGoogleOAuthConfig();
    await db.collection("oauthStates").doc(state).set({
      uid: employee.uid,
      locationId: employee.locationId,
      redirectUri,
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 10 * 60 * 1000,
    });
    const oauth = makeGoogleOAuthClient();
    const url = oauth.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: GOOGLE_SCOPES, state, include_granted_scopes: true });
    return Response.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authErrorResponse(error) ?? googleIntegrationErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const employee = await requireEmployee(request);
    const connectionRef = db.collection("googleConnections").doc(employee.uid);
    const connection = await connectionRef.get();
    let revoked = false;

    if (connection.data()?.refreshTokenEncrypted) {
      try {
        const refreshToken = decryptSecret(connection.data()!.refreshTokenEncrypted);
        await makeGoogleOAuthClient().revokeToken(refreshToken);
        revoked = true;
      } catch {
        // Local disconnect must still succeed for an expired/revoked token.
      }
    }

    const batch = db.batch();
    batch.delete(connectionRef);
    batch.set(
      db.collection("employees").doc(employee.uid),
      { calendarSettings: FieldValue.delete(), updatedAt: new Date().toISOString() },
      { merge: true },
    );
    await batch.commit();
    return Response.json({ ok: true, revoked });
  } catch (error) {
    return authErrorResponse(error) ?? googleIntegrationErrorResponse(error);
  }
}
