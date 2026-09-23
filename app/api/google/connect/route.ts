import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { authErrorResponse, requireEmployee } from "@/lib/auth-server";
import { db } from "@/lib/firebase/admin";
import { GOOGLE_SCOPES, makeGoogleOAuthClient } from "@/lib/google-calendar";

export async function POST(request: NextRequest) {
  try {
    const employee = await requireEmployee(request);
    const state = crypto.randomBytes(32).toString("hex");
    await db.collection("oauthStates").doc(state).set({ uid: employee.uid, locationId: employee.locationId, createdAtMs: Date.now(), expiresAtMs: Date.now() + 10 * 60 * 1000 });
    const oauth = makeGoogleOAuthClient();
    const url = oauth.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: GOOGLE_SCOPES, state, include_granted_scopes: true });
    return Response.json({ url });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: error instanceof Error ? error.message : "Грешка при Google свързване." }, { status: 500 });
  }
}
