"use client";

import { use, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CalendarSync,
  CheckCircle2,
  Pencil,
  RotateCcw,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Protected } from "@/components/protected";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { apiFetch } from "@/lib/api-client";
import {
  addIsoDays,
  formatIsoDate,
  todayInSofia,
} from "@/lib/time";

type VehicleDetails = {
  id: string;
  registrationNumber: string;
  gtpStartDate?: string;
  gtpEndDate?: string;
  vignetteStartDate?: string;
  vignetteEndDate?: string;
  registrationCertificateNumber?: string;
};

type Dossier = {
  client: {
    id: string;
    phone: string;
    email?: string;
  };

  vehicles: VehicleDetails[];

  policies: Array<{
    id: string;
    vehicleId: string;
    policyNumber: string;
    startDate: string;
    endDate: string;
    totalAmount: number;
    currency: string;
  }>;

  installments: Array<{
    id: string;
    policyId: string;
    sequence: number;
    totalCount: number;
    dueDate: string;
    amount: number;
    currency: string;
    paymentStatus: "pending" | "paid";
    paidAt: string | null;
    calendarSyncStatus: string;
  }>;

  auditLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    actorEmail?: string;
  }>;
};

function expiryStatus(
  endDate: string | undefined,
  validLabel: string,
  expiredLabel: string,
) {
  if (!endDate) {
    return null;
  }

  const today = todayInSofia();

  if (endDate < today) {
    return {
      label: expiredLabel,
      variant: "danger" as const,
    };
  }

  if (endDate <= addIsoDays(today, 30)) {
    return {
      label: "Изтича скоро",
      variant: "warning" as const,
    };
  }

  return {
    label: validLabel,
    variant: "success" as const,
  };
}

function datePeriod(
  startDate?: string,
  endDate?: string,
) {
  if (!startDate || !endDate) {
    return "Няма данни";
  }

  return `${formatIsoDate(startDate)} – ${formatIsoDate(endDate)}`;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [data, setData] =
    useState<Dossier | null>(null);

  const load = useCallback(
    () =>
      apiFetch<Dossier>(
        `/api/clients/${id}`,
      )
        .then(setData)
        .catch((e) =>
          toast.error(
            e instanceof Error
              ? e.message
              : "Грешка при зареждане",
          ),
        ),
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function updateVehicle(
    vehicleId: string,
    patch: Partial<VehicleDetails>,
    successMessage: string,
  ) {
    try {
      await apiFetch(
        `/api/vehicles/${vehicleId}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      );

      toast.success(successMessage);

      await load();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Грешка при редакция",
      );
    }
  }

  async function editGtp(
    vehicle: VehicleDetails,
  ) {
    const startDate = window.prompt(
      "Начална дата на ГТП (YYYY-MM-DD)",
      vehicle.gtpStartDate ?? "",
    );

    if (startDate === null) {
      return;
    }

    const endDate = window.prompt(
      "Крайна дата на ГТП (YYYY-MM-DD)",
      vehicle.gtpEndDate ?? "",
    );

    if (endDate === null) {
      return;
    }

    if (
      !isIsoDate(startDate) ||
      !isIsoDate(endDate)
    ) {
      toast.error(
        "Датите трябва да бъдат във формат YYYY-MM-DD.",
      );

      return;
    }

    if (startDate > endDate) {
      toast.error(
        "Началната дата не може да бъде след крайната.",
      );

      return;
    }

    await updateVehicle(
      vehicle.id,
      {
        gtpStartDate: startDate,
        gtpEndDate: endDate,
      },
      "Данните за ГТП са обновени.",
    );
  }

  async function editVignette(
    vehicle: VehicleDetails,
  ) {
    const startDate = window.prompt(
      "Начална дата на винетката (YYYY-MM-DD)",
      vehicle.vignetteStartDate ?? "",
    );

    if (startDate === null) {
      return;
    }

    const endDate = window.prompt(
      "Крайна дата на винетката (YYYY-MM-DD)",
      vehicle.vignetteEndDate ?? "",
    );

    if (endDate === null) {
      return;
    }

    if (
      !isIsoDate(startDate) ||
      !isIsoDate(endDate)
    ) {
      toast.error(
        "Датите трябва да бъдат във формат YYYY-MM-DD.",
      );

      return;
    }

    if (startDate > endDate) {
      toast.error(
        "Началната дата не може да бъде след крайната.",
      );

      return;
    }

    await updateVehicle(
      vehicle.id,
      {
        vignetteStartDate: startDate,
        vignetteEndDate: endDate,
      },
      "Данните за винетката са обновени.",
    );
  }

  async function editRegistrationCertificate(
    vehicle: VehicleDetails,
  ) {
    const value = window.prompt(
      "Номер на СРМПС",
      vehicle.registrationCertificateNumber ??
        "",
    );

    if (value === null) {
      return;
    }

    const registrationCertificateNumber =
      value.trim();

    await updateVehicle(
      vehicle.id,
      {
        registrationCertificateNumber,
      },
      "Номерът на СРМПС е обновен.",
    );
  }

  async function editPolicyNumber(
    policyId: string,
    currentPolicyNumber: string,
  ) {
    const value = window.prompt(
      "Нов номер на полицата",
      currentPolicyNumber,
    );

    if (value === null) {
      return;
    }

    const policyNumber = value.trim();

    if (!policyNumber) {
      toast.error(
        "Номерът на полицата не може да бъде празен.",
      );

      return;
    }

    if (
      policyNumber === currentPolicyNumber
    ) {
      return;
    }

    try {
      await apiFetch(
        `/api/policies/${policyId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            policyNumber,
          }),
        },
      );

      toast.success(
        "Номерът на полицата е променен.",
      );

      await load();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Грешка при редакция на полицата.",
      );
    }
  }

  async function setPaid(
    installmentId: string,
    paid: boolean,
  ) {
    try {
      await apiFetch(
        `/api/installments/${installmentId}/payment`,
        {
          method: "PATCH",
          body: JSON.stringify({
            paid,
          }),
        },
      );

      toast.success(
        paid
          ? "Вноската е отбелязана като платена."
          : "Плащането е отменено.",
      );

      await load();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Грешка",
      );
    }
  }

  async function sync(
    installmentId: string,
  ) {
    try {
      await apiFetch(
        `/api/google/sync/${installmentId}`,
        {
          method: "POST",
        },
      );

      toast.success(
        "Календарът е обновен.",
      );

      await load();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Грешка при синхронизация",
      );
    }
  }

  async function editDueDate(
    installmentId: string,
    current: string,
  ) {
    const dueDate = window.prompt(
      "Нова дата на падежа (YYYY-MM-DD)",
      current,
    );

    if (
      !dueDate ||
      dueDate === current
    ) {
      return;
    }

    if (!isIsoDate(dueDate)) {
      toast.error(
        "Датата трябва да бъде във формат YYYY-MM-DD.",
      );

      return;
    }

    try {
      await apiFetch(
        `/api/installments/${installmentId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            dueDate,
          }),
        },
      );

      toast.success(
        "Падежът е променен и календарът е обновен.",
      );

      await load();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Грешка при редакция",
      );
    }
  }

  async function editPhone() {
    if (!data) {
      return;
    }

    const phone = window.prompt(
      "Нов телефонен номер",
      data.client.phone,
    );

    if (
      !phone ||
      phone === data.client.phone
    ) {
      return;
    }

    try {
      await apiFetch(
        `/api/clients/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            phone,
          }),
        },
      );

      toast.success(
        "Телефонът е променен без да се губи историята.",
      );

      await load();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Грешка при редакция",
      );
    }
  }

  async function editEmail() {
    if (!data) {
      return;
    }

    const email = window.prompt(
      "Email на клиента (остави празно за премахване)",
      data.client.email ?? "",
    );

    if (
      email === null ||
      email ===
        (data.client.email ?? "")
    ) {
      return;
    }

    try {
      await apiFetch(
        `/api/clients/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            email,
          }),
        },
      );

      toast.success(
        "Email адресът е обновен.",
      );

      await load();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Грешка при редакция",
      );
    }
  }

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  return (
    <Protected>
      <AppShell>
        <div className="space-y-6 pb-20 lg:pb-0">
          {/* CLIENT HEADER */}

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Досие на клиента
              </h1>

              <p className="text-sm text-muted-foreground">
                {data
                  ? `${data.client.phone} · ${
                      data.client.email ??
                      "Няма email"
                    }`
                  : "Зареждане…"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={editPhone}
                disabled={!data}
              >
                <Pencil className="size-4" />
                Редактирай телефон
              </Button>

              <Button
                variant="outline"
                onClick={editEmail}
                disabled={!data}
              >
                <Pencil className="size-4" />
                Редактирай email
              </Button>
            </div>
          </div>

          {/* SUMMARY */}

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>
                  Автомобили
                </CardDescription>

                <CardTitle className="text-3xl">
                  {data?.vehicles.length ??
                    "—"}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>
                  Полици
                </CardDescription>

                <CardTitle className="text-3xl">
                  {data?.policies.length ??
                    "—"}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>
                  Неплатени вноски
                </CardDescription>

                <CardTitle className="text-3xl">
                  {data?.installments.filter(
                    (x) =>
                      x.paymentStatus ===
                      "pending",
                  ).length ?? "—"}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* POLICIES */}

          {(data?.policies ?? []).map(
            (policy) => {
              const vehicle =
                data?.vehicles.find(
                  (v) =>
                    v.id ===
                    policy.vehicleId,
                );

              const installments =
                data?.installments.filter(
                  (i) =>
                    i.policyId ===
                    policy.id,
                ) ?? [];

              const paid = installments
                .filter(
                  (i) =>
                    i.paymentStatus ===
                    "paid",
                )
                .reduce(
                  (sum, installment) =>
                    sum +
                    installment.amount,
                  0,
                );

              const gtpStatus =
                expiryStatus(
                  vehicle?.gtpEndDate,
                  "Валидно",
                  "Изтекло",
                );

              const vignetteStatus =
                expiryStatus(
                  vehicle?.vignetteEndDate,
                  "Валидна",
                  "Изтекла",
                );

              return (
                <Card key={policy.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        {/* POLICY NUMBER + EDIT */}

                        <div className="flex flex-wrap items-center gap-1.5">
                          <CardTitle>
                            Полица №
                            {
                              policy.policyNumber
                            }
                          </CardTitle>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0"
                            onClick={() =>
                              void editPolicyNumber(
                                policy.id,
                                policy.policyNumber,
                              )
                            }
                            aria-label="Редактирай номер на полицата"
                            title="Редактирай номер на полицата"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </div>

                        <CardDescription>
                          {
                            vehicle?.registrationNumber
                          }{" "}
                          · {policy.startDate} –{" "}
                          {policy.endDate}
                        </CardDescription>
                      </div>

                      <div className="text-right text-sm">
                        <div>
                          Платено:{" "}
                          <strong>
                            {paid.toFixed(2)}{" "}
                            {
                              policy.currency
                            }
                          </strong>
                        </div>

                        <div className="text-muted-foreground">
                          Остава:{" "}
                          {Math.max(
                            0,
                            policy.totalAmount -
                              paid,
                          ).toFixed(2)}{" "}
                          {policy.currency}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* VEHICLE INFO */}

                    <div className="mb-5 grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-3">
                      {/* ГТП */}

                      <div className="rounded-xl border bg-background p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            ГТП
                          </p>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={
                              !vehicle
                            }
                            onClick={() => {
                              if (
                                vehicle
                              ) {
                                void editGtp(
                                  vehicle,
                                );
                              }
                            }}
                            aria-label="Редактирай ГТП"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                          <span>
                            {datePeriod(
                              vehicle?.gtpStartDate,
                              vehicle?.gtpEndDate,
                            )}
                          </span>

                          {gtpStatus && (
                            <Badge
                              variant={
                                gtpStatus.variant
                              }
                            >
                              {
                                gtpStatus.label
                              }
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* ВИНЕТКА */}

                      <div className="rounded-xl border bg-background p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Винетка
                          </p>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={
                              !vehicle
                            }
                            onClick={() => {
                              if (
                                vehicle
                              ) {
                                void editVignette(
                                  vehicle,
                                );
                              }
                            }}
                            aria-label="Редактирай винетка"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                          <span>
                            {datePeriod(
                              vehicle?.vignetteStartDate,
                              vehicle?.vignetteEndDate,
                            )}
                          </span>

                          {vignetteStatus && (
                            <Badge
                              variant={
                                vignetteStatus.variant
                              }
                            >
                              {
                                vignetteStatus.label
                              }
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* СРМПС */}

                      <div className="rounded-xl border bg-background p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            СРМПС
                          </p>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={
                              !vehicle
                            }
                            onClick={() => {
                              if (
                                vehicle
                              ) {
                                void editRegistrationCertificate(
                                  vehicle,
                                );
                              }
                            }}
                            aria-label="Редактирай СРМПС"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </div>

                        <p className="mt-1 text-sm">
                          {vehicle?.registrationCertificateNumber ||
                            "Няма данни"}
                        </p>
                      </div>
                    </div>

                    {/* INSTALLMENTS */}

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            Вноска
                          </TableHead>

                          <TableHead>
                            Падеж
                          </TableHead>

                          <TableHead>
                            Сума
                          </TableHead>

                          <TableHead>
                            Статус
                          </TableHead>

                          <TableHead>
                            Календар
                          </TableHead>

                          <TableHead className="text-right">
                            Действие
                          </TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {installments.map(
                          (installment) => {
                            const overdue =
                              installment.paymentStatus ===
                                "pending" &&
                              installment.dueDate <
                                today;

                            return (
                              <TableRow
                                key={
                                  installment.id
                                }
                              >
                                <TableCell>
                                  {
                                    installment.sequence
                                  }
                                  /
                                  {
                                    installment.totalCount
                                  }
                                </TableCell>

                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <span>
                                      {
                                        installment.dueDate
                                      }
                                    </span>

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        void editDueDate(
                                          installment.id,
                                          installment.dueDate,
                                        )
                                      }
                                      aria-label="Редактирай падеж"
                                    >
                                      <Pencil className="size-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  {installment.amount.toFixed(
                                    2,
                                  )}{" "}
                                  {
                                    installment.currency
                                  }
                                </TableCell>

                                <TableCell>
                                  {installment.paymentStatus ===
                                  "paid" ? (
                                    <Badge variant="success">
                                      Платена
                                    </Badge>
                                  ) : overdue ? (
                                    <Badge variant="danger">
                                      Просрочена
                                    </Badge>
                                  ) : (
                                    <Badge variant="warning">
                                      Предстояща
                                    </Badge>
                                  )}
                                </TableCell>

                                <TableCell>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      void sync(
                                        installment.id,
                                      )
                                    }
                                  >
                                    <CalendarSync className="size-4" />

                                    {installment.calendarSyncStatus ===
                                    "synced"
                                      ? "Синхронизирана"
                                      : "Синхронизирай"}
                                  </Button>
                                </TableCell>

                                <TableCell className="text-right">
                                  {installment.paymentStatus ===
                                  "paid" ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        void setPaid(
                                          installment.id,
                                          false,
                                        )
                                      }
                                    >
                                      <RotateCcw className="size-4" />
                                      Отмени
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() =>
                                        void setPaid(
                                          installment.id,
                                          true,
                                        )
                                      }
                                    >
                                      <CheckCircle2 className="size-4" />
                                      Платена
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          },
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            },
          )}

          {/* AUDIT LOG */}

          <Card>
            <CardHeader>
              <CardTitle>
                История на действията
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-2">
              {(data?.auditLogs ?? [])
                .length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Няма история.
                </p>
              ) : (
                data!.auditLogs.map(
                  (log) => (
                    <div
                      key={log.id}
                      className="flex justify-between gap-4 rounded-xl border p-3 text-sm"
                    >
                      <div>
                        <strong>
                          {log.action}
                        </strong>

                        <div className="text-muted-foreground">
                          {
                            log.entityType
                          }{" "}
                          ·{" "}
                          {log.actorEmail ??
                            "служител"}
                        </div>
                      </div>

                      <span className="whitespace-nowrap text-muted-foreground">
                        {String(
                          log.createdAt,
                        )
                          .replace(
                            "T",
                            " ",
                          )
                          .slice(0, 16)}
                      </span>
                    </div>
                  ),
                )
              )}
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </Protected>
  );
}