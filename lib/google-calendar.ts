import { google } from "googleapis";
import { db } from "@/lib/firebase/admin";
import { decryptSecret, encryptSecret } from "@/lib/token-crypto";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

export type GoogleIntegrationErrorCode =
  | "CONFIGURATION_ERROR"
  | "NOT_CONNECTED"
  | "REAUTHORIZATION_REQUIRED"
  | "GOOGLE_API_ERROR";

export class GoogleIntegrationError extends Error {
  constructor(
    public readonly code: GoogleIntegrationErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GoogleIntegrationError";
  }
}

type EncryptedSecret = { iv: string; tag: string; data: string };

function isEncryptedSecret(value: unknown): value is EncryptedSecret {
  if (!value || typeof value !== "object") return false;
  const token = value as Partial<EncryptedSecret>;
  return Boolean(token.iv && token.tag && token.data);
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new GoogleIntegrationError(
      "CONFIGURATION_ERROR",
      `Липсва server-side настройката ${name}.`,
      500,
    );
  }
  return value;
}

function normalizedHttpUrl(value: string, name: string) {
  try {
    const url = new URL(value);
    const localDevelopment = ["localhost", "127.0.0.1", "[::1]"].includes(
      url.hostname,
    );
    if (
      !["http:", "https:"].includes(url.protocol) ||
      (!localDevelopment && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error("invalid URL");
    }
    return url;
  } catch {
    throw new GoogleIntegrationError(
      "CONFIGURATION_ERROR",
      `${name} трябва да е валиден http/https URL.`,
      500,
    );
  }
}

export function getGoogleOAuthConfig() {
  const appBaseUrl = normalizedHttpUrl(requiredEnv("APP_BASE_URL"), "APP_BASE_URL");
  if (appBaseUrl.pathname !== "/") {
    throw new GoogleIntegrationError(
      "CONFIGURATION_ERROR",
      "APP_BASE_URL трябва да съдържа само origin, без допълнителен path.",
      500,
    );
  }
  appBaseUrl.pathname = appBaseUrl.pathname.replace(/\/$/, "") || "/";
  const redirectUri = normalizedHttpUrl(
    requiredEnv("GOOGLE_REDIRECT_URI"),
    "GOOGLE_REDIRECT_URI",
  );
  const expectedRedirect = new URL("/api/google/callback", appBaseUrl);
  if (redirectUri.toString() !== expectedRedirect.toString()) {
    throw new GoogleIntegrationError(
      "CONFIGURATION_ERROR",
      "GOOGLE_REDIRECT_URI трябва да съвпада точно с APP_BASE_URL + /api/google/callback.",
      500,
    );
  }

  return {
    clientId: requiredEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requiredEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: redirectUri.toString(),
    appBaseUrl: appBaseUrl.toString().replace(/\/$/, ""),
  };
}

export function googleSettingsUrl(status?: string) {
  const { appBaseUrl } = getGoogleOAuthConfig();
  const url = new URL("/settings/calendar", `${appBaseUrl}/`);
  if (status) url.searchParams.set("google", status);
  return url;
}

export function makeGoogleOAuthClient() {
  const config = getGoogleOAuthConfig();
  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
  );
}

export async function getGoogleConnection(uid: string) {
  const snapshot = await db.collection("googleConnections").doc(uid).get();
  const data = snapshot.data();
  const hasRefreshToken = isEncryptedSecret(data?.refreshTokenEncrypted);
  return {
    snapshot,
    data,
    connected:
      snapshot.exists && hasRefreshToken && data?.reauthorizationRequired !== true,
    requiresReconnect:
      snapshot.exists && hasRefreshToken && data?.reauthorizationRequired === true,
  };
}

export async function markGoogleReauthorizationRequired(uid: string) {
  await db.collection("googleConnections").doc(uid).set(
    {
      reauthorizationRequired: true,
      lastErrorCode: "invalid_grant",
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export function googleHttpStatus(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    code?: unknown;
    response?: { status?: unknown };
  };
  const status = Number(candidate.response?.status ?? candidate.code);
  return Number.isInteger(status) ? status : undefined;
}

export function isGoogleReauthorizationError(error: unknown) {
  if (error instanceof GoogleIntegrationError) {
    return error.code === "REAUTHORIZATION_REQUIRED";
  }
  if (!error || typeof error !== "object") return false;
  if (googleHttpStatus(error) === 401) return true;
  const candidate = error as {
    message?: unknown;
    response?: { data?: { error?: unknown; error_description?: unknown } };
  };
  const apiError = candidate.response?.data?.error;
  const errorCode =
    typeof apiError === "string"
      ? apiError
      : apiError && typeof apiError === "object" && "status" in apiError
        ? String((apiError as { status?: unknown }).status)
        : "";
  return /invalid_grant|invalid_token|unauthenticated/i.test(
    `${errorCode} ${String(candidate.response?.data?.error_description ?? "")} ${String(candidate.message ?? "")}`,
  );
}

export async function getAuthorizedGoogleClient(uid: string) {
  const connection = await getGoogleConnection(uid);
  if (!connection.snapshot.exists || !connection.data?.refreshTokenEncrypted) {
    throw new GoogleIntegrationError(
      "NOT_CONNECTED",
      "Google Calendar не е свързан.",
      409,
    );
  }
  if (connection.data.reauthorizationRequired === true) {
    throw new GoogleIntegrationError(
      "REAUTHORIZATION_REQUIRED",
      "Google достъпът е изтекъл или е отнет. Свържете акаунта отново.",
      409,
    );
  }
  const oauth = makeGoogleOAuthClient();
  try {
    oauth.setCredentials({
      refresh_token: decryptSecret(connection.data.refreshTokenEncrypted),
    });
  } catch {
    throw new GoogleIntegrationError(
      "CONFIGURATION_ERROR",
      "Запазеният Google token не може да бъде декриптиран.",
      500,
    );
  }
  oauth.on("tokens", (tokens) => {
    if (!tokens.refresh_token) return;
    void db.collection("googleConnections").doc(uid).set(
      {
        refreshTokenEncrypted: encryptSecret(tokens.refresh_token),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  });
  return oauth;
}

export function calendarApi(auth: ReturnType<typeof makeGoogleOAuthClient>) {
  return google.calendar({ version: "v3", auth });
}

export function googleIntegrationErrorResponse(error: unknown) {
  if (error instanceof GoogleIntegrationError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  return Response.json(
    {
      error: "Google Calendar временно не отговори. Опитайте отново.",
      code: "GOOGLE_API_ERROR",
    },
    { status: 502 },
  );
}
