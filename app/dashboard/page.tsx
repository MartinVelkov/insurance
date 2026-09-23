"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, FileClock, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Protected } from "@/components/protected";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api-client";

type Row = {
  id: string;
  dueDate: string;
  amount: number;
  currency: string;
  sequence: number;
  totalCount: number;
  clientPhone: string;
  registrationNumber: string;
  policyNumber: string;
};

type Expiring = { id: string; endDate: string; policyNumber: string; registrationNumber: string; clientPhone: string };
type ExpiringVehicle = { id: string; endDate: string; registrationNumber: string; clientPhone: string };

type DashboardData = {
  upcoming: Row[];
  overdue: Row[];
  expiring: Expiring[];
  expiringGtp: ExpiringVehicle[];
  expiringVignettes: ExpiringVehicle[];
};

function PaymentTable({ rows, overdue = false }: { rows: Row[]; overdue?: boolean }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Падеж</TableHead><TableHead>Автомобил</TableHead><TableHead>Полица</TableHead><TableHead>Вноска</TableHead><TableHead className="text-right">Сума</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Няма записи.</TableCell></TableRow> : rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell><Badge variant={overdue ? "danger" : "warning"}>{row.dueDate}</Badge></TableCell>
            <TableCell className="font-medium">{row.registrationNumber}</TableCell>
            <TableCell>{row.policyNumber}</TableCell>
            <TableCell>{row.sequence}/{row.totalCount}</TableCell>
            <TableCell className="text-right font-medium">{row.amount.toFixed(2)} {row.currency}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function VehicleExpiryTable({ rows, emptyText }: { rows: ExpiringVehicle[]; emptyText: string }) {
  return <Table><TableHeader><TableRow><TableHead>Валидно до</TableHead><TableHead>Автомобил</TableHead><TableHead>Телефон</TableHead></TableRow></TableHeader>
    <TableBody>{rows.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">{emptyText}</TableCell></TableRow> : rows.map((row) => <TableRow key={row.id}><TableCell><Badge variant="warning">{row.endDate}</Badge></TableCell><TableCell className="font-medium">{row.registrationNumber}</TableCell><TableCell>{row.clientPhone}</TableCell></TableRow>)}</TableBody>
  </Table>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [search, setSearch] = useState("");
  const [days, setDays] = useState("30");
  const [status, setStatus] = useState("all");

useEffect(() => {
  async function loadDashboard() {
    try {
      const result =
        await apiFetch<DashboardData>(
          `/api/dashboard?days=${days}`,
        );

      console.log(
        "DASHBOARD RESPONSE:",
        result,
      );

      setData(result);
    } catch (error) {
      console.error(
        "DASHBOARD ERROR:",
        error,
      );

      setData(null);
    }
  }

  void loadDashboard();
}, [days]);
  return (
    <Protected><AppShell>
      <div className="space-y-6 pb-20 lg:pb-0">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><h1 className="text-2xl font-semibold tracking-tight">Работно табло</h1><p className="text-sm text-muted-foreground">Падежи, просрочия и изтичащи полици на едно място.</p></div>
          <Button asChild><Link href="/policies/new"><Plus className="size-4" />Нова полица</Link></Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form action="/clients" className="flex gap-2">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input name="q" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Телефон, регистрационен номер или № полица" /></div>
              <Button type="submit">Търси</Button>
            </form>
          </CardContent>
        </Card>


        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end">
            <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Период</label><select className="h-10 rounded-xl border bg-background px-3 text-sm" value={days} onChange={(e) => setDays(e.target.value)}><option value="7">7 дни</option><option value="30">30 дни</option><option value="60">60 дни</option><option value="90">90 дни</option></select></div>
            <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Статус</label><select className="h-10 rounded-xl border bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Всички</option><option value="overdue">Просрочени</option><option value="upcoming">Предстоящи</option><option value="expiring">Изтичащи полици</option><option value="gtp">Изтичащи ГТП</option><option value="vignettes">Изтичащи винетки</option></select></div>
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card><CardHeader className="pb-3"><CardDescription className="flex items-center gap-2"><CalendarClock className="size-4" />Предстоящи</CardDescription><CardTitle className="text-3xl">{data?.upcoming.length ?? "—"}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-3"><CardDescription className="flex items-center gap-2"><AlertTriangle className="size-4" />Просрочени</CardDescription><CardTitle className="text-3xl">{data?.overdue.length ?? "—"}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-3"><CardDescription className="flex items-center gap-2"><FileClock className="size-4" />Изтичат до {days} дни</CardDescription><CardTitle className="text-3xl">{data?.expiring.length ?? "—"}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-3"><CardDescription className="flex items-center gap-2"><FileClock className="size-4" />ГТП до 30 дни</CardDescription><CardTitle className="text-3xl">{data?.expiringGtp.length ?? "—"}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-3"><CardDescription className="flex items-center gap-2"><FileClock className="size-4" />Винетки до 30 дни</CardDescription><CardTitle className="text-3xl">{data?.expiringVignettes.length ?? "—"}</CardTitle></CardHeader></Card>
        </div>

        {(status === "all" || status === "overdue") && <Card><CardHeader><CardTitle>Просрочени вноски</CardTitle><CardDescription>Неплатени вноски с изминал падеж.</CardDescription></CardHeader><CardContent><PaymentTable rows={data?.overdue ?? []} overdue /></CardContent></Card>}
        {(status === "all" || status === "upcoming") && <Card><CardHeader><CardTitle>Предстоящи плащания</CardTitle><CardDescription>Следващите {days} дни.</CardDescription></CardHeader><CardContent><PaymentTable rows={data?.upcoming ?? []} /></CardContent></Card>}
        {(status === "all" || status === "expiring") && <Card><CardHeader><CardTitle>Полици, които скоро изтичат</CardTitle></CardHeader><CardContent>
          <Table><TableHeader><TableRow><TableHead>Край</TableHead><TableHead>Автомобил</TableHead><TableHead>Полица</TableHead><TableHead>Телефон</TableHead></TableRow></TableHeader>
            <TableBody>{(data?.expiring ?? []).length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Няма записи.</TableCell></TableRow> : data!.expiring.map((p) => <TableRow key={p.id}><TableCell><Badge variant="warning">{p.endDate}</Badge></TableCell><TableCell className="font-medium">{p.registrationNumber}</TableCell><TableCell>{p.policyNumber}</TableCell><TableCell>{p.clientPhone}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent></Card>}
        {(status === "all" || status === "gtp") && <Card><CardHeader><CardTitle>Изтичащи ГТП</CardTitle><CardDescription>ГТП, които изтичат през следващите 30 дни.</CardDescription></CardHeader><CardContent><VehicleExpiryTable rows={data?.expiringGtp ?? []} emptyText="Няма изтичащи ГТП." /></CardContent></Card>}
        {(status === "all" || status === "vignettes") && <Card><CardHeader><CardTitle>Изтичащи винетки</CardTitle><CardDescription>Винетки, които изтичат през следващите 30 дни.</CardDescription></CardHeader><CardContent><VehicleExpiryTable rows={data?.expiringVignettes ?? []} emptyText="Няма изтичащи винетки." /></CardContent></Card>}
      </div>
    </AppShell></Protected>
  );
}
