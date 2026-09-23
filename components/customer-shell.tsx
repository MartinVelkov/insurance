"use client";

import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase/client";

export function CustomerShell({ email, children }: { email?: string; children: React.ReactNode }) {
  const router = useRouter();
  async function logout() {
    await signOut(auth);
    router.replace("/portal/login");
  }

  return <div className="min-h-screen bg-muted/25">
    <header className="border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></div>
          <div className="min-w-0"><p className="font-semibold leading-tight">Силвия</p><p className="truncate text-xs text-muted-foreground">Клиентски портал{email ? ` · ${email}` : ""}</p></div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={logout}><LogOut className="size-4" /><span className="hidden sm:inline">Изход</span></Button>
      </div>
    </header>
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
  </div>;
}
