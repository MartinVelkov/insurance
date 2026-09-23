"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api-client";
import { auth } from "@/lib/firebase/client";

export default function CustomerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await apiFetch("/api/portal/me");
      router.replace("/portal");
    } catch (error) {
      await signOut(auth).catch(() => undefined);
      toast.error(error instanceof ApiError && error.status === 403
        ? "Нямате активиран клиентски достъп."
        : "Невалиден email или парола.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      toast.error("Въведете email адреса си.");
      return;
    }
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast.success("Изпратихме инструкции за нова парола.");
    } catch {
      toast.error("Неуспешно изпращане. Проверете email адреса.");
    } finally {
      setResetting(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-muted/30 px-4 py-10">
    <Card className="w-full max-w-md border-border/70 shadow-lg shadow-black/5">
      <CardHeader className="space-y-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></div>
        <div><CardTitle>Клиентски портал</CardTitle><CardDescription className="mt-1">Влезте, за да прегледате автомобилите, полиците и плащанията си.</CardDescription></div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="customer-email">Email</Label><Input id="customer-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="customer-password">Парола</Label><Input id="customer-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
          <Button className="h-10 w-full rounded-xl" disabled={loading}>{loading ? "Влизане…" : <><LockKeyhole className="size-4" />Вход</>}</Button>
          <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={resetPassword} disabled={resetting}>{resetting ? "Изпращане…" : "Забравена парола"}</Button>
        </form>
      </CardContent>
    </Card>
  </main>;
}
