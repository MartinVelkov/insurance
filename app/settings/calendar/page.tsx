"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Link2, Loader2, Save, Unlink } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";

type CalendarItem = {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole?: string;
};
type Settings = {
  connected: boolean;
  requiresReconnect?: boolean;
  calendarId?: string;
  reminderMinutes?: number[];
};

export default function CalendarSettingsPage() {
  const [settings, setSettings] = useState<Settings>({ connected: false });
  const [calendars, setCalendars] = useState<CalendarItem[]>([]);
  const [calendarId, setCalendarId] = useState("");
  const [reminder, setReminder] = useState("1440");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function load() {
    try {
      const s = await apiFetch<Settings>("/api/google/settings");
      setSettings(s);
      setCalendarId(s.calendarId ?? "");
      setReminder(String(s.reminderMinutes?.[0] ?? 1440));
      if (s.connected)
        setCalendars(
          (
            await apiFetch<{ calendars: CalendarItem[] }>(
              "/api/google/calendars",
            )
          ).calendars,
        );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("google");
    const messages: Record<string, { type: "success" | "error"; text: string }> = {
      connected: { type: "success", text: "Google Calendar е свързан успешно." },
      denied: { type: "error", text: "Не дадохте достъп до Google Calendar." },
      state: { type: "error", text: "Заявката за свързване е изтекла. Опитайте отново." },
      invalid_request: { type: "error", text: "Невалиден OAuth отговор. Опитайте отново." },
      missing_scopes: { type: "error", text: "Не са дадени всички необходими Calendar права." },
      oauth_error: { type: "error", text: "Google свързването не бе завършено." },
    };
    const message = status ? messages[status] : undefined;
    if (message?.type === "success") toast.success(message.text);
    if (message?.type === "error") toast.error(message.text);
    if (status) window.history.replaceState({}, "", "/settings/calendar");
    void load();
  }, []);

  async function connect() {
    setConnecting(true);
    try {
      const { url } = await apiFetch<{ url: string }>("/api/google/connect", {
        method: "POST",
      });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка");
      setConnecting(false);
    }
  }
  async function save() {
    setSaving(true);
    try {
      await apiFetch("/api/google/settings", {
        method: "PUT",
        body: JSON.stringify({
          calendarId,
          reminderMinutes: [Number(reminder)],
        }),
      });
      toast.success("Настройките са запазени.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Да прекъсна ли връзката с Google Calendar?")) return;
    setDisconnecting(true);
    try {
      await apiFetch("/api/google/connect", { method: "DELETE" });
      setSettings({ connected: false });
      setCalendars([]);
      setCalendarId("");
      toast.success("Google Calendar е изключен.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка при изключване.");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <Protected>
      <AppShell>
        <div className="space-y-6 pb-20 lg:pb-0">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Google Calendar
            </h1>
            <p className="text-sm text-muted-foreground">
              Свързването с Google е отделно от входа в системата.
            </p>
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Google акаунт</CardTitle>
                  <CardDescription>
                    Използва се само за събитията за падежите.
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    settings.connected
                      ? "success"
                      : settings.requiresReconnect
                        ? "warning"
                        : "outline"
                  }
                >
                  {settings.connected
                    ? "Свързан"
                    : settings.requiresReconnect
                      ? "Нужно е повторно свързване"
                      : "Несвързан"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={connect} variant={settings.connected ? "outline" : "default"} disabled={loading || connecting || disconnecting}>
                {connecting ? <Loader2 className="size-4 animate-spin" /> : settings.connected ? <CalendarCheck className="size-4" /> : <Link2 className="size-4" />}
                {connecting ? "Пренасочване…" : settings.connected ? "Свържи отново" : "Свържи Google Calendar"}
              </Button>
              {(settings.connected || settings.requiresReconnect) && (
                <Button variant="ghost" onClick={disconnect} disabled={disconnecting || connecting}>
                  {disconnecting ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4" />}
                  {disconnecting ? "Изключване…" : "Изключи"}
                </Button>
              )}
            </CardContent>
          </Card>
          {loading && (
            <Card>
              <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Зареждане на календарните настройки…
              </CardContent>
            </Card>
          )}
          {settings.connected && (
            <Card>
              <CardHeader>
                <CardTitle>Календар и напомняне</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Календар</Label>
                  <select
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                    value={calendarId}
                    onChange={(e) => setCalendarId(e.target.value)}
                  >
                    <option value="">Избери календар</option>
                    {calendars
                      .filter((c) =>
                        ["owner", "writer"].includes(c.accessRole ?? ""),
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.summary}
                          {c.primary ? " (основен)" : ""}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Напомняне преди падежа (минути)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={reminder}
                    onChange={(e) => setReminder(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    1440 = 1 ден, 2880 = 2 дни, 10080 = 7 дни.
                  </p>
                </div>
                <div className="md:col-span-2">
                  <Button onClick={save} disabled={!calendarId || saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {saving ? "Запазване…" : "Запази настройките"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </AppShell>
    </Protected>
  );
}
