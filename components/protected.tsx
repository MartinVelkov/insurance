"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api-client";

export function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    apiFetch<{ ok: boolean }>("/api/me")
      .then(() => setAllowed(true))
      .catch(async () => {
        await signOut();
        router.replace("/login?error=access");
      })
      .finally(() => setChecking(false));
  }, [loading, pathname, router, signOut, user]);

  if (loading || checking || !allowed) {
    return <div className="grid min-h-screen place-items-center"><LoaderCircle className="size-7 animate-spin text-muted-foreground" /></div>;
  }
  return children;
}
