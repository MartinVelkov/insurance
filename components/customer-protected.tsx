"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { signOut } from "firebase/auth";
import { useAuth } from "@/components/auth-provider";
import { ApiError, apiFetch } from "@/lib/api-client";
import { auth } from "@/lib/firebase/client";

export function CustomerProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [accessError, setAccessError] = useState(false);

  useEffect(() => {
    let active = true;
    if (loading) return () => { active = false; };
    if (!user) {
      setAllowed(false);
      setChecking(false);
      router.replace(`/portal/login?next=${encodeURIComponent(pathname)}`);
      return () => { active = false; };
    }

    setChecking(true);
    setAccessError(false);
    apiFetch("/api/portal/me")
      .then(() => { if (active) setAllowed(true); })
      .catch(async (error: unknown) => {
        if (!active) return;
        setAllowed(false);
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await signOut(auth).catch(() => undefined);
          router.replace("/portal/login?error=access");
        } else {
          setAccessError(true);
        }
      })
      .finally(() => { if (active) setChecking(false); });

    return () => { active = false; };
  }, [loading, pathname, router, user]);

  if (accessError) {
    return <div className="grid min-h-screen place-items-center bg-muted/30 px-4 text-center text-sm text-muted-foreground">Неуспешно зареждане на данните.</div>;
  }
  if (loading || checking || !allowed) {
    return <div className="grid min-h-screen place-items-center bg-muted/30"><LoaderCircle className="size-7 animate-spin text-primary" /></div>;
  }
  return children;
}
