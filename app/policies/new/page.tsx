"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Protected } from "@/components/protected";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerBG, formatDateBG } from "@/components/ui/date-picker-bg";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { apiFetch } from "@/lib/api-client";

import {
  generateInstallments,
  sumInstallments,
  type DraftInstallment,
} from "@/lib/installments";

import type { Currency } from "@/lib/types";
import { getOneYearEndDate } from "@/lib/time";

type PolicyCheckStatus = "idle" | "checking" | "available" | "exists" | "error";

export default function NewPolicyPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);

  const [policyCheckStatus, setPolicyCheckStatus] =
    useState<PolicyCheckStatus>("idle");

  const [form, setForm] = useState({
    phone: "",
    registrationNumber: "",
    policyNumber: "",
    gtpStartDate: "",
    gtpEndDate: "",
    vignetteStartDate: "",
    vignetteEndDate: "",
    registrationCertificateNumber: "",
    startDate: "",
    endDate: "",
    totalAmount: "",
    currency: "EUR" as Currency,
    installmentCount: "4",
    periodMonths: "3",
  });

  const [manualPlan, setManualPlan] = useState<DraftInstallment[] | null>(null);

  /**
   * Генериране на погасителния план
   */
  const generated = useMemo(() => {
    try {
      return generateInstallments({
        startDate: form.startDate,
        totalAmount: Number(form.totalAmount),
        installmentCount: Number(form.installmentCount),
        periodMonths: Number(form.periodMonths),
        currency: form.currency,
      });
    } catch {
      return [];
    }
  }, [form]);

  const plan = manualPlan ?? generated;

  /**
   * Ръчна промяна на падеж или сума
   */
  function updatePlan(
    index: number,
    field: "dueDate" | "amount",
    value: string,
  ) {
    const base = (manualPlan ?? generated).map((item) => ({
      ...item,
    }));

    if (field === "amount") {
      base[index].amount = Number(value);
    } else {
      base[index].dueDate = value;
    }

    setManualPlan(base);
  }

  /**
   * Проверка дали номерът на полицата
   * вече съществува.
   */
  async function checkPolicyNumber(policyNumber: string): Promise<boolean> {
    const value = policyNumber.trim().toUpperCase();

    if (!value) {
      setPolicyCheckStatus("idle");
      return false;
    }

    setPolicyCheckStatus("checking");

    try {
      const result = await apiFetch<{
        exists: boolean;
      }>(
        `/api/policies/check-number?policyNumber=${encodeURIComponent(value)}`,
      );

      if (result.exists) {
        setPolicyCheckStatus("exists");
        return true;
      }

      setPolicyCheckStatus("available");

      return false;
    } catch (error) {
      console.error("Policy number check failed:", error);

      setPolicyCheckStatus("error");

      return false;
    }
  }

  /**
   * Записване на полицата
   */
  async function submit(e: FormEvent) {
    e.preventDefault();

    /*
     * Проверяваме номера отново непосредствено
     * преди запис.
     */
    const exists = await checkPolicyNumber(form.policyNumber);

    if (exists) {
      toast.error("Полица с този номер вече съществува.");

      return;
    }

    if (policyCheckStatus === "error") {
      toast.error("Номерът на полицата не можа да бъде проверен.");

      return;
    }

    if (plan.length === 0) {
      return toast.error("Провери данните за погасителния план.");
    }

    if (Math.abs(sumInstallments(plan) - Number(form.totalAmount)) > 0.001) {
      return toast.error(
        "Сборът на вноските трябва да съвпада с общата стойност.",
      );
    }

    setSaving(true);

    try {
      const result = await apiFetch<{
        policyId: string;
        clientId: string;
        calendar: {
          synced: number;
          failed: number;
        };
      }>("/api/policies", {
        method: "POST",

        body: JSON.stringify({
          ...form,

          policyNumber: form.policyNumber.trim(),

          totalAmount: Number(form.totalAmount),

          installmentCount: Number(form.installmentCount),

          periodMonths: Number(form.periodMonths),

          installments: plan,
        }),
      });

      toast.success(
        result.calendar.failed
          ? `Полицата е записана. ${result.calendar.synced} събития са синхронизирани, ${result.calendar.failed} чакат повторен опит.`
          : "Полицата и падежите са записани успешно.",
      );

      router.push(`/clients/${result.clientId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Грешка при запис");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Protected>
      <AppShell>
        <div className="space-y-6 pb-20 lg:pb-0">
          {/* HEADER */}

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Нова полица
            </h1>

            <p className="text-sm text-muted-foreground">
              Въведи основните данни, прегледай падежите и запази.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-6">
            {/* ==========================================
                CLIENT / VEHICLE
            ========================================== */}

            <Card>
              <CardHeader>
                <CardTitle>Данни за клиента и автомобила</CardTitle>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-3">
                {/* PHONE */}

                <div className="space-y-2">
                  <Label>Телефонен номер</Label>

                  <Input
                    required
                    placeholder="0888 123 456"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        phone: e.target.value,
                      })
                    }
                  />
                </div>

                {/* REGISTRATION */}

                <div className="space-y-2">
                  <Label>Регистрационен номер</Label>

                  <Input
                    required
                    placeholder="СВ1234АВ"
                    value={form.registrationNumber}
                    onChange={(e) =>
                      setForm({
                        ...form,

                        registrationNumber: e.target.value,
                      })
                    }
                  />
                </div>

                {/* POLICY NUMBER */}

                <div className="space-y-2">
                  <Label>Номер на полицата</Label>

                  <div className="relative">
                    <Input
                      required
                      placeholder="123456789"
                      value={form.policyNumber}
                      className={
                        policyCheckStatus === "exists"
                          ? "border-destructive pr-10 focus-visible:ring-destructive"
                          : policyCheckStatus === "available"
                            ? "pr-10"
                            : "pr-10"
                      }
                      onChange={(e) => {
                        setPolicyCheckStatus("idle");

                        setForm({
                          ...form,

                          policyNumber: e.target.value,
                        });
                      }}
                      onBlur={(e) => {
                        if (e.target.value.trim()) {
                          void checkPolicyNumber(e.target.value);
                        }
                      }}
                    />

                    {/* CHECKING */}

                    {policyCheckStatus === "checking" && (
                      <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}

                    {/* AVAILABLE */}

                    {policyCheckStatus === "available" && (
                      <CheckCircle2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-green-600" />
                    )}

                    {/* EXISTS */}

                    {policyCheckStatus === "exists" && (
                      <XCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-destructive" />
                    )}
                  </div>

                  {/* STATUS */}

                  {policyCheckStatus === "checking" && (
                    <p className="text-sm text-muted-foreground">
                      Проверка на номера…
                    </p>
                  )}

                  {policyCheckStatus === "available" && (
                    <p className="flex items-center gap-1 text-sm font-medium text-green-600">
                      <CheckCircle2 className="size-4" />
                      Номерът на полицата е свободен.
                    </p>
                  )}

                  {policyCheckStatus === "exists" && (
                    <p className="flex items-center gap-1 text-sm font-medium text-destructive">
                      <XCircle className="size-4" />
                      Полица с този номер вече съществува.
                    </p>
                  )}

                  {policyCheckStatus === "error" && (
                    <p className="text-sm text-destructive">
                      Неуспешна проверка на номера.
                    </p>
                  )}
                </div>

                {/* GTP */}

                <div className="space-y-2 rounded-xl border p-3">
                  <Label>ГТП</Label>

                  <DatePickerBG
                    value={form.gtpStartDate}
                    onChange={(gtpStartDate) => {
                      setForm({
                        ...form,
                        gtpStartDate,
                        gtpEndDate: getOneYearEndDate(gtpStartDate),
                      });
                    }}
                  />

                  <p className="text-xs text-muted-foreground">
                    Валидно до:{" "}
                    <span className="font-medium text-foreground">
                      {form.gtpEndDate ? formatDateBG(form.gtpEndDate) : "—"}
                    </span>
                  </p>
                </div>

                {/* VIGNETTE */}

                <div className="space-y-2 rounded-xl border p-3">
                  <Label htmlFor="vignetteStartDate">Винетка</Label>
                  <DatePickerBG
                    value={form.vignetteStartDate}
                    onChange={(vignetteStartDate) => {
                      setForm({
                        ...form,
                        vignetteStartDate,
                        vignetteEndDate: getOneYearEndDate(vignetteStartDate),
                      });
                    }}
                    placeholder="ДД/ММ/ГГГГ"
                  />
                  <p className="text-xs text-muted-foreground">
                    Валидна до:{" "}
                    <span className="font-medium text-foreground">
                      {form.vignetteEndDate
                        ? formatDateBG(form.vignetteEndDate)
                        : "—"}
                    </span>
                  </p>
                </div>

                {/* REGISTRATION CERTIFICATE */}

                <div className="space-y-2 rounded-xl border p-3">
                  <Label htmlFor="registrationCertificateNumber">№ СРМПС</Label>
                  <Input
                    id="registrationCertificateNumber"
                    placeholder="№ на свидетелството за регистрация"
                    value={form.registrationCertificateNumber}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        registrationCertificateNumber: e.target.value,
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* ==========================================
                PERIOD + PAYMENT
            ========================================== */}

            <Card>
              <CardHeader>
                <CardTitle>Период и плащане</CardTitle>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-3">
                {/* START DATE */}

                <div className="space-y-2">
                  <Label>Начална дата</Label>

                  <DatePickerBG
                    value={form.startDate}
                    onChange={(startDate) => {
                      setManualPlan(null);

                      setForm({
                        ...form,
                        startDate,
                        endDate: getOneYearEndDate(startDate),
                      });
                    }}
                  />
                </div>

                {/* END DATE */}

                <div className="space-y-2">
                  <Label>Дата на изтичане</Label>

                  <Input
                    required
                    type="text"
                    value={formatDateBG(form.endDate)}
                    placeholder="ДД/ММ/ГГГГ"
                    readOnly
                  />
                </div>

                {/* TOTAL AMOUNT */}

                <div className="space-y-2">
                  <Label>Обща стойност</Label>

                  <div className="flex gap-2">
                    <Input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.totalAmount}
                      onChange={(e) => {
                        setManualPlan(null);

                        setForm({
                          ...form,

                          totalAmount: e.target.value,
                        });
                      }}
                    />

                    <select
                      className="rounded-xl border bg-background px-3 text-sm"
                      value={form.currency}
                      onChange={(e) => {
                        setManualPlan(null);

                        setForm({
                          ...form,

                          currency: e.target.value as Currency,
                        });
                      }}
                    >
                      <option value="EUR">EUR</option>

                      <option value="BGN">BGN</option>
                    </select>
                  </div>
                </div>

                {/* INSTALLMENT COUNT */}

                <div className="space-y-2">
                  <Label>Брой вноски</Label>

                  <Select
                    value={form.installmentCount}
                    onValueChange={(value) => {
                      setManualPlan(null);

                      /*
                       * Автоматично задаваме
                       * правилния период:
                       *
                       * 1 вноска -> няма значение
                       * 2 вноски -> през 6 месеца
                       * 4 вноски -> през 3 месеца
                       */
                      let periodMonths = "3";

                      if (value === "2") {
                        periodMonths = "6";
                      }

                      if (value === "4") {
                        periodMonths = "3";
                      }

                      if (value === "1") {
                        periodMonths = "12";
                      }

                      setForm({
                        ...form,

                        installmentCount: value,

                        periodMonths,
                      });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Избери брой вноски" />
                    </SelectTrigger>

                    <SelectContent className="z-[9999] border bg-white shadow-xl">
                      <SelectItem value="1">1 вноска</SelectItem>

                      <SelectItem value="2">2 вноски</SelectItem>

                      <SelectItem value="4">4 вноски</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* PERIOD */}

                <div className="space-y-2">
                  <Label>Период между вноските</Label>

                  <Input
                    readOnly
                    value={
                      form.installmentCount === "1"
                        ? "Еднократно"
                        : form.installmentCount === "2"
                          ? "На 6 месеца"
                          : "На 3 месеца"
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* ==========================================
                INSTALLMENTS
            ========================================== */}

            <Card>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle>Погасителен план</CardTitle>

                  <CardDescription>
                    Първата вноска е на началната дата. Можеш да коригираш дата
                    или сума преди запис.
                  </CardDescription>
                </div>

                {manualPlan && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setManualPlan(null)}
                  >
                    <RefreshCcw className="size-4" />
                    Автоматично
                  </Button>
                )}
              </CardHeader>

              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>№</TableHead>

                      <TableHead>Падеж</TableHead>

                      <TableHead>Сума</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {plan.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-muted-foreground"
                        >
                          Въведи начална дата, обща стойност и брой вноски.
                        </TableCell>
                      </TableRow>
                    ) : (
                      plan.map((item, index) => (
                        <TableRow key={item.sequence}>
                          <TableCell className="font-medium">
                            {item.sequence}/{item.totalCount}
                          </TableCell>

                          <TableCell>
                            <DatePickerBG
                              value={item.dueDate}
                              onChange={(value) =>
                                updatePlan(index, "dueDate", value)
                              }
                            />
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input
                                className="max-w-40"
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.amount}
                                onChange={(e) =>
                                  updatePlan(index, "amount", e.target.value)
                                }
                              />

                              <span className="text-sm text-muted-foreground">
                                {item.currency}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {plan.length > 0 && (
                  <div className="mt-4 flex justify-end text-sm">
                    <span className="rounded-xl bg-muted px-4 py-2">
                      Общо:{" "}
                      <strong>
                        {sumInstallments(plan).toFixed(2)} {form.currency}
                      </strong>
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ==========================================
                SUBMIT
            ========================================== */}

            <div className="flex justify-end">
              <Button
                size="lg"
                disabled={
                  saving ||
                  policyCheckStatus === "checking" ||
                  policyCheckStatus === "exists"
                }
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CalendarPlus className="size-4" />
                )}

                {saving ? "Записване…" : "Запази полица и падежи"}
              </Button>
            </div>
          </form>
        </div>
      </AppShell>
    </Protected>
  );
}
