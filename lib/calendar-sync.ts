import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { addDays, format, parseISO } from "date-fns";
import {
  calendarApi,
  getAuthorizedGoogleClient,
  getGoogleConnection,
  GoogleIntegrationError,
  googleHttpStatus,
  isGoogleReauthorizationError,
  markGoogleReauthorizationRequired,
} from "@/lib/google-calendar";
import { db } from "@/lib/firebase/admin";
import { requireAccessibleDocument, type EmployeeIdentity } from "@/lib/auth-server";

export async function syncInstallmentToCalendar(installmentId: string, employee: EmployeeIdentity) {
  const installmentRef = db.collection("installments").doc(installmentId);
  const installmentSnap = await requireAccessibleDocument("installments", installmentId, employee);
  const installment = installmentSnap.data()!;

  const [policySnap, clientSnap, vehicleSnap, employeeSnap, connection] = await Promise.all([
    requireAccessibleDocument("policies", installment.policyId, employee),
    requireAccessibleDocument("clients", installment.clientId, employee),
    requireAccessibleDocument("vehicles", installment.vehicleId, employee),
    db.collection("employees").doc(employee.uid).get(),
    getGoogleConnection(employee.uid),
  ]);

  if (!policySnap.exists || !clientSnap.exists || !vehicleSnap.exists) {
    throw new Error("Липсват свързани данни за календарната синхронизация.");
  }

  const policy = policySnap.data()!;
  const client = clientSnap.data()!;
  const vehicle = vehicleSnap.data()!;
  const legacySettings = employeeSnap.data()?.calendarSettings ?? {};
  const calendarId = connection.data?.calendarId ?? legacySettings.calendarId;
  const configuredReminders: unknown =
    connection.data?.reminderMinutes ?? legacySettings.reminderMinutes ?? [1440];
  const reminderMinutes = Array.isArray(configuredReminders)
    ? configuredReminders.filter(
        (value): value is number =>
          Number.isInteger(value) && value >= 0 && value <= 40320,
      ).slice(0, 5)
    : [1440];
  if (!calendarId) {
    throw new GoogleIntegrationError(
      "NOT_CONNECTED",
      "Не е избран Google календар.",
      409,
    );
  }

  const oauth = await getAuthorizedGoogleClient(employee.uid);
  const calendar = calendarApi(oauth);
  const isPaid = installment.paymentStatus === "paid";
  const titlePrefix = isPaid ? "ПЛАТЕНО — " : "";
  const summary = `${titlePrefix}Вноска ${installment.sequence}/${installment.totalCount} — ${vehicle.registrationNumber} — Полица №${policy.policyNumber}`;
  const description = [
    `Телефон: ${client.phone}`,
    `Регистрационен номер: ${vehicle.registrationNumber}`,
    `Полица №${policy.policyNumber}`,
    `Вноска: ${installment.sequence}/${installment.totalCount}`,
    `Сума: ${Number(installment.amount).toFixed(2)} ${installment.currency}`,
    `Падеж: ${installment.dueDate}`,
    `Валидност: ${policy.startDate} – ${policy.endDate}`,
    `Статус: ${isPaid ? `Платена${installment.paidAt ? ` на ${String(installment.paidAt).slice(0, 10)}` : ""}` : "Неплатена"}`,
  ].join("\n");

  const event = {
    summary,
    description,
    start: { date: installment.dueDate },
    end: { date: format(addDays(parseISO(installment.dueDate), 1), "yyyy-MM-dd") },
    reminders: {
      useDefault: false,
      overrides: reminderMinutes.map((minutes) => ({ method: "popup" as const, minutes })),
    },
  };

  try {
    let eventId =
      typeof installment.googleEventId === "string"
        ? installment.googleEventId
        : null;
    const previousCalendarId =
      typeof installment.googleCalendarId === "string"
        ? installment.googleCalendarId
        : typeof connection.data?.previousCalendarId === "string"
          ? connection.data.previousCalendarId
          : null;

    if (eventId && previousCalendarId && previousCalendarId !== calendarId) {
      try {
        await calendar.events.delete({
          calendarId: previousCalendarId,
          eventId,
        });
      } catch (error) {
        if (googleHttpStatus(error) !== 404 && googleHttpStatus(error) !== 410) {
          throw error;
        }
      }
      eventId = null;
    }

    if (eventId) {
      try {
        await calendar.events.update({ calendarId, eventId, requestBody: event });
      } catch (error) {
        if (googleHttpStatus(error) !== 404 && googleHttpStatus(error) !== 410) {
          throw error;
        }
        eventId = null;
      }
    }

    if (!eventId) {
      const deterministicEventId = crypto
        .createHash("sha256")
        .update(`insurance-installment:${installmentId}`)
        .digest("hex");
      try {
        const inserted = await calendar.events.insert({
          calendarId,
          requestBody: { ...event, id: deterministicEventId },
        });
        eventId = inserted.data.id ?? deterministicEventId;
      } catch (error) {
        if (googleHttpStatus(error) !== 409) throw error;
        await calendar.events.update({
          calendarId,
          eventId: deterministicEventId,
          requestBody: event,
        });
        eventId = deterministicEventId;
      }
    }

    await installmentRef.update({
      googleEventId: eventId,
      googleCalendarId: calendarId,
      calendarSyncStatus: "synced",
      calendarSyncError: null,
      updatedAt: new Date().toISOString(),
      lastCalendarSyncAt: FieldValue.serverTimestamp(),
    });
    return { eventId };
  } catch (error) {
    const needsReconnect = isGoogleReauthorizationError(error);
    if (needsReconnect) await markGoogleReauthorizationRequired(employee.uid);
    const message = needsReconnect
      ? "Google достъпът е изтекъл или е отнет. Свържете акаунта отново."
      : "Google Calendar синхронизацията не бе успешна.";
    await installmentRef.update({
      calendarSyncStatus: "error",
      calendarSyncError: message,
      updatedAt: new Date().toISOString(),
    });
    if (needsReconnect) {
      throw new GoogleIntegrationError(
        "REAUTHORIZATION_REQUIRED",
        message,
        409,
      );
    }
    throw error;
  }
}
