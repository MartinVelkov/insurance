"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Link2, Save } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Protected } from "@/components/protected";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";

type CalendarItem = { id: string; summary: string; primary?: boolean; accessRole?: string };
type Settings = { connected: boolean; calendarId?: string; reminderMinutes?: number[] };

export default function CalendarSettingsPage() {
  const [settings, setSettings] = useState<Settings>({ connected: false });
  const [calendars, setCalendars] = useState<CalendarItem[]>([]);
  const [calendarId, setCalendarId] = useState("");
  const [reminder, setReminder] = useState("1440");

  async function load() {
    try {
      const s = await apiFetch<Settings>("/api/google/settings");
      setSettings(s); setCalendarId(s.calendarId ?? ""); setReminder(String(s.reminderMinutes?.[0] ?? 1440));
      if (s.connected) setCalendars((await apiFetch<{ calendars: CalendarItem[] }>("/api/google/calendars")).calendars);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Грешка"); }
  }
  useEffect(() => { load(); }, []);

  async function connect() {
    try { const { url } = await apiFetch<{ url: string }>("/api/google/connect", { method: "POST" }); window.location.href = url; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Грешка"); }
  }
  async function save() {
    try { await apiFetch("/api/google/settings", { method: "PUT", body: JSON.stringify({ calendarId, reminderMinutes: [Number(reminder)] }) }); toast.success("Настройките са запазени."); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Грешка"); }
  }

  return <Protected><AppShell><div className="space-y-6 pb-20 lg:pb-0">
    <div><h1 className="text-2xl font-semibold tracking-tight">Google Calendar</h1><p className="text-sm text-muted-foreground">Свързването с Google е отделно от входа в системата.</p></div>
    <Card><CardHeader><div className="flex items-center justify-between gap-4"><div><CardTitle>Google акаунт</CardTitle><CardDescription>Използва се само за събитията за падежите.</CardDescription></div><Badge variant={settings.connected ? "success" : "outline"}>{settings.connected ? "Свързан" : "Несвързан"}</Badge></div></CardHeader><CardContent><Button onClick={connect} variant={settings.connected ? "outline" : "default"}><Link2 className="size-4" />{settings.connected ? "Свържи отново" : "Свържи Google Calendar"}</Button></CardContent></Card>
    {settings.connected && <Card><CardHeader><CardTitle>Календар и напомняне</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2"><Label>Календар</Label><select className="h-10 w-full rounded-xl border bg-background px-3 text-sm" value={calendarId} onChange={(e) => setCalendarId(e.target.value)}><option value="">Избери календар</option>{calendars.filter((c) => ["owner", "writer"].includes(c.accessRole ?? "")).map((c) => <option key={c.id} value={c.id}>{c.summary}{c.primary ? " (основен)" : ""}</option>)}</select></div>
      <div className="space-y-2"><Label>Напомняне преди падежа (минути)</Label><Input type="number" min="0" value={reminder} onChange={(e) => setReminder(e.target.value)} /><p className="text-xs text-muted-foreground">1440 = 1 ден, 2880 = 2 дни, 10080 = 7 дни.</p></div>
      <div className="md:col-span-2"><Button onClick={save} disabled={!calendarId}><Save className="size-4" />Запази настройките</Button></div>
    </CardContent></Card>}
  </div></AppShell></Protected>;
}
