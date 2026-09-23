import { FieldValue } from "firebase-admin/firestore";
import { addDays, format, parseISO } from "date-fns";
import { calendarApi, getAuthorizedGoogleClient } from "@/lib/google-calendar";
import { db } from "@/lib/firebase/admin";
import { requireAccessibleDocument, type EmployeeIdentity } from "@/lib/auth-server";

export async function syncInstallmentToCalendar(installmentId: string, employee: EmployeeIdentity) {
  const installmentRef = db.collection("installments").doc(installmentId);
  const installmentSnap = await requireAccessibleDocument("installments", installmentId, employee);
  const installment = installmentSnap.data()!;

  const [policySnap, clientSnap, vehicleSnap, employeeSnap] = await Promise.all([
    requireAccessibleDocument("policies", installment.policyId, employee),
    requireAccessibleDocument("clients", installment.clientId, employee),
    requireAccessibleDocument("vehicles", installment.vehicleId, employee),
    db.collection("employees").doc(employee.uid).get(),
  ]);

  if (!policySnap.exists || !clientSnap.exists || !vehicleSnap.exists) {
    throw new Error("Липсват свързани данни за календарната синхронизация.");
  }

  const policy = policySnap.data()!;
  const client = clientSnap.data()!;
  const vehicle = vehicleSnap.data()!;
  const calendarId = employeeSnap.data()?.calendarSettings?.calendarId;
  const reminderMinutes: number[] = employeeSnap.data()?.calendarSettings?.reminderMinutes ?? [1440];
  if (!calendarId) throw new Error("Не е избран Google календар.");

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
    let eventId = installment.googleEventId as string | null;
    if (eventId) {
      await calendar.events.update({ calendarId, eventId, requestBody: event });
    } else {
      const inserted = await calendar.events.insert({ calendarId, requestBody: event });
      eventId = inserted.data.id ?? null;
    }

    await installmentRef.update({
      googleEventId: eventId,
      calendarSyncStatus: "synced",
      calendarSyncError: null,
      updatedAt: new Date().toISOString(),
      lastCalendarSyncAt: FieldValue.serverTimestamp(),
    });
    return { eventId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестна Google Calendar грешка";
    await installmentRef.update({
      calendarSyncStatus: "error",
      calendarSyncError: message.slice(0, 1000),
      updatedAt: new Date().toISOString(),
    });
    throw error;
  }
}
