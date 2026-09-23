"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      await apiFetch("/api/me");
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next || "/dashboard");
    } catch (error) {
      await signOut(auth).catch(() => undefined);
      toast.error(error instanceof Error ? error.message : "Неуспешен вход");
    } finally { setLoading(false); }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></div>
          <CardTitle>Вход за служители</CardTitle>
          <CardDescription>Достъп имат само предварително упълномощени служители.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="email">Имейл</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="password">Парола</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            <Button className="w-full" disabled={loading}>{loading ? "Влизане…" : "Вход"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
