"use client";

import { useCallback, useEffect, useState } from "react";
import { CarFront, Mail, Phone, ReceiptText } from "lucide-react";
import { CustomerProtected } from "@/components/customer-protected";
import { CustomerShell } from "@/components/customer-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";
import { addIsoDays, formatIsoDate, todayInSofia } from "@/lib/time";
import type { CustomerPortalData } from "@/lib/types";

type BadgeVariant = "success" | "warning" | "danger";

function expiryStatus(endDate: string | undefined, valid: string, expired: string): { label: string; variant: BadgeVariant } | null {
  if (!endDate) return null;
  const today = todayInSofia();
  if (endDate < today) return { label: expired, variant: "danger" };
  if (endDate <= addIsoDays(today, 30)) return { label: "Изтича скоро", variant: "warning" };
  return { label: valid, variant: "success" };
}

function period(startDate?: string, endDate?: string) {
  return startDate && endDate ? `${formatIsoDate(startDate)} – ${formatIsoDate(endDate)}` : "Няма данни";
}

function PortalSkeleton() {
  return <div className="space-y-5 animate-pulse"><div className="h-8 w-56 rounded-lg bg-muted" /><div className="h-4 w-72 rounded bg-muted" /><div className="h-72 rounded-2xl bg-muted" /></div>;
}

export default function CustomerPortalPage() {
  const [data, setData] = useState<CustomerPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await apiFetch<CustomerPortalData>("/api/portal/me");
      setData(result);
      setError(false);
    } catch {
      if (!silent) setError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const interval = window.setInterval(() => void load(true), 30_000);
    const onVisibilityChange = () => { if (document.visibilityState === "visible") void load(true); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [load]);

  return <CustomerProtected><CustomerShell email={data?.client.email}>
    {loading ? <PortalSkeleton /> : error || !data ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Неуспешно зареждане на данните.</CardContent></Card> : <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">Моите автомобили</h1><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"><span className="flex items-center gap-1.5"><Phone className="size-3.5" />{data.client.phone || "Няма телефон"}</span><span className="flex items-center gap-1.5"><Mail className="size-3.5" />{data.client.email || "Няма email"}</span></div></div>

      {data.vehicles.length === 0 ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">В момента няма добавени автомобили.</CardContent></Card> : data.vehicles.map((vehicle) => {
        const policies = data.policies.filter((policy) => policy.vehicleId === vehicle.id);
        const gtp = expiryStatus(vehicle.gtpEndDate, "Валидно", "Изтекло");
        const vignette = expiryStatus(vehicle.vignetteEndDate, "Валидна", "Изтекла");
        return <Card key={vehicle.id} className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><CarFront className="size-5" /></div><div><CardTitle>{vehicle.registrationNumber}</CardTitle><CardDescription>Информация за автомобила и активните полици</CardDescription></div></div></CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border p-3"><p className="text-xs font-medium text-muted-foreground">ГТП</p><p className="mt-1 text-sm">{period(vehicle.gtpStartDate, vehicle.gtpEndDate)}</p>{gtp && <Badge className="mt-2" variant={gtp.variant}>{gtp.label}</Badge>}</div>
              <div className="rounded-xl border p-3"><p className="text-xs font-medium text-muted-foreground">Винетка</p><p className="mt-1 text-sm">{period(vehicle.vignetteStartDate, vehicle.vignetteEndDate)}</p>{vignette && <Badge className="mt-2" variant={vignette.variant}>{vignette.label}</Badge>}</div>
              <div className="rounded-xl border p-3"><p className="text-xs font-medium text-muted-foreground">СРМПС</p><p className="mt-1 text-sm">{vehicle.registrationCertificateNumber || "Няма данни"}</p></div>
            </div>

            {policies.length === 0 ? <p className="text-sm text-muted-foreground">Няма добавени полици за този автомобил.</p> : policies.map((policy) => {
              const installments = data.installments.filter((installment) => installment.policyId === policy.id);
              const paidAmount = installments.filter((installment) => installment.paymentStatus === "paid").reduce((sum, installment) => sum + installment.amount, 0);
              const remaining = Math.max(0, policy.totalAmount - paidAmount);
              const today = todayInSofia();
              return <section key={policy.id} className="rounded-2xl border">
                <div className="flex flex-col justify-between gap-3 border-b p-4 sm:flex-row sm:items-start"><div><h3 className="font-semibold">Полица №{policy.policyNumber}</h3><p className="mt-1 text-sm text-muted-foreground">{formatIsoDate(policy.startDate)} – {formatIsoDate(policy.endDate)}</p></div><div className="text-sm sm:text-right"><p>Общо: <strong>{policy.totalAmount.toFixed(2)} {policy.currency}</strong></p><p className="text-muted-foreground">Платено: {paidAmount.toFixed(2)} {policy.currency} · Остава: {remaining.toFixed(2)} {policy.currency}</p></div></div>
                <div className="space-y-2 p-4"><div className="mb-3 flex items-center gap-2 text-sm font-medium"><ReceiptText className="size-4 text-muted-foreground" />Плащания</div>{installments.length === 0 ? <p className="text-sm text-muted-foreground">Няма добавени вноски.</p> : installments.map((installment) => {
                  const status = installment.paymentStatus === "paid"
                    ? { label: "Платена", variant: "success" as const }
                    : installment.dueDate < today
                      ? { label: "Просрочена", variant: "danger" as const }
                      : { label: "Предстояща", variant: "warning" as const };
                  return <div key={installment.id} className="flex flex-col gap-2 rounded-xl bg-muted/35 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-x-4 gap-y-1"><strong>{installment.sequence}/{installment.totalCount}</strong><span>{formatIsoDate(installment.dueDate)}</span><span>{installment.amount.toFixed(2)} {installment.currency}</span></div><Badge variant={status.variant}>{status.label}</Badge></div>;
                })}</div>
              </section>;
            })}
          </CardContent>
        </Card>;
      })}
    </div>}
  </CustomerShell></CustomerProtected>;
}
