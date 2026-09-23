import { google } from "googleapis";
import { db } from "@/lib/firebase/admin";
import { decryptSecret } from "@/lib/token-crypto";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

export function makeGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Липсва Google OAuth конфигурация.");
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function getAuthorizedGoogleClient(uid: string) {
  const snap = await db.collection("googleConnections").doc(uid).get();
  const encrypted = snap.data()?.refreshTokenEncrypted;
  if (!encrypted) throw new Error("Google Calendar не е свързан.");
  const oauth = makeGoogleOAuthClient();
  oauth.setCredentials({ refresh_token: decryptSecret(encrypted) });
  return oauth;
}

export function calendarApi(auth: ReturnType<typeof makeGoogleOAuthClient>) {
  return google.calendar({ version: "v3", auth });
}
