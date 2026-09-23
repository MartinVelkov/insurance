import type { Currency } from "@/lib/types";

export interface DraftInstallment {
  sequence: number;
  totalCount: number;
  dueDate: string;
  amount: number;
  currency: Currency;
}

function parseIsoDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) throw new Error("Невалидна дата");
  return { year, month, day };
}

function daysInMonth(year: number, month1Based: number) {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

export function addMonthsClamped(isoDate: string, monthsToAdd: number): string {
  const { year, month, day } = parseIsoDate(isoDate);
  const zeroBasedTarget = year * 12 + (month - 1) + monthsToAdd;
  const targetYear = Math.floor(zeroBasedTarget / 12);
  const targetMonthZero = zeroBasedTarget % 12;
  const targetMonth = targetMonthZero + 1;
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return `${targetYear.toString().padStart(4, "0")}-${targetMonth
    .toString()
    .padStart(2, "0")}-${targetDay.toString().padStart(2, "0")}`;
}

export function generateInstallments(params: {
  startDate: string;
  totalAmount: number;
  installmentCount: number;
  periodMonths: number;
  currency: Currency;
}): DraftInstallment[] {
  const { startDate, totalAmount, installmentCount, periodMonths, currency } = params;
  if (!startDate) throw new Error("Липсва начална дата");
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) throw new Error("Невалидна обща сума");
  if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 24) {
    throw new Error("Броят вноски трябва да е между 1 и 24");
  }
  if (!Number.isInteger(periodMonths) || periodMonths < 1 || periodMonths > 24) {
    throw new Error("Периодът трябва да е между 1 и 24 месеца");
  }

  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / installmentCount);
  const remainder = totalCents - baseCents * installmentCount;

  return Array.from({ length: installmentCount }, (_, index) => {
    const cents = baseCents + (index < remainder ? 1 : 0);
    return {
      sequence: index + 1,
      totalCount: installmentCount,
      dueDate: addMonthsClamped(startDate, index * periodMonths),
      amount: cents / 100,
      currency,
    };
  });
}

export function sumInstallments(items: Pick<DraftInstallment, "amount">[]) {
  return Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
}
