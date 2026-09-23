"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Protected } from "@/components/protected";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";

type Result = { clientId: string; phone: string; matchedBy: string; registrationNumber?: string; policyNumber?: string };

export default function ClientsPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q");
    if (initial) setQ((current) => current || initial);
  }, []);

  useEffect(() => {
    if (q.trim().length < 4) { setResults([]); return; }
    const timer = setTimeout(() => {
      setLoading(true);
      apiFetch<{ results: Result[] }>(`/api/search?q=${encodeURIComponent(q)}`).then((x) => setResults(x.results)).catch(() => setResults([])).finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  return <Protected><AppShell><div className="space-y-6 pb-20 lg:pb-0">
    <div><h1 className="text-2xl font-semibold tracking-tight">Клиенти</h1><p className="text-sm text-muted-foreground">Търси по телефон, регистрационен номер или номер на полица.</p></div>
    <Card><CardContent className="pt-6"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Напр. 0888123456, СВ1234АВ, 123456" /></div></CardContent></Card>
    <div className="grid gap-3">
      {loading && <p className="text-sm text-muted-foreground">Търсене…</p>}
      {!loading && q.length >= 4 && results.length === 0 && <p className="text-sm text-muted-foreground">Няма намерени клиенти.</p>}
      {results.map((r) => <Card key={`${r.clientId}-${r.matchedBy}-${r.registrationNumber ?? r.policyNumber ?? ""}`}><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">{r.phone}</CardTitle><CardDescription>{r.registrationNumber ? `Автомобил: ${r.registrationNumber}` : r.policyNumber ? `Полица: ${r.policyNumber}` : "Съвпадение по телефон"}</CardDescription></div><Button asChild variant="outline"><Link href={`/clients/${r.clientId}`}>Отвори досие</Link></Button></CardHeader></Card>)}
    </div>
  </div></AppShell></Protected>;
}
