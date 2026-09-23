"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  CarFront,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const nav = [
  ["/dashboard", "Табло", LayoutDashboard],
  ["/clients", "Клиенти", Search],
  ["/policies/new", "Нова полица", PlusCircle],
  ["/settings/calendar", "Календар", CalendarDays],
] as const;

type Employee = {
  uid: string;
  email: string;
  role: "owner" | "employee";
  locationId: string;
  active: boolean;
};

type MeResponse = {
  ok: boolean;
  employee: Employee;
};

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const { user, signOut } = useAuth();

  const [employee, setEmployee] =
    useState<Employee | null>(null);

  const [employeeLoading, setEmployeeLoading] =
    useState(true);

  useEffect(() => {
    if (!user) {
      setEmployee(null);
      setEmployeeLoading(false);
      return;
    }

    let cancelled = false;

    async function loadEmployee() {
      try {
        setEmployeeLoading(true);

        const result =
          await apiFetch<MeResponse>(
            "/api/me",
          );

        if (!cancelled) {
          setEmployee(
            result.employee,
          );
        }
      } catch (error) {
        console.error(
          "Неуспешно зареждане на служителя:",
          error,
        );

        if (!cancelled) {
          setEmployee(null);
        }
      } finally {
        if (!cancelled) {
          setEmployeeLoading(false);
        }
      }
    }

    void loadEmployee();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSignOut() {
    await signOut();

    router.replace("/login");
  }

  function getRoleLabel(
    role?: Employee["role"],
  ) {
    if (role === "owner") {
      return "Собственик";
    }

    if (role === "employee") {
      return "Служител";
    }

    return "";
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* HEADER */}

      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-6">
          {/* LOGO */}

          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <CarFront className="size-5" />
            </span>

            <span>Силвия</span>
          </Link>

          {/* USER */}

          <div className="flex items-center gap-3">
            <div className="min-w-0 text-right">
              {/* EMAIL */}

              <p className="max-w-[240px] truncate text-sm font-medium text-foreground">
                {employee?.email ??
                  user?.email ??
                  "Потребител"}
              </p>

              {/* ROLE */}

              <p className="text-xs text-muted-foreground">
                {employeeLoading
                  ? "Зареждане..."
                  : getRoleLabel(
                      employee?.role,
                    )}
              </p>
            </div>

            {/* LOGOUT */}

            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              aria-label="Изход"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* CONTENT */}

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr] lg:px-6">
        {/* SIDEBAR */}

        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            {nav.map(
              ([href, label, Icon]) => {
                const active =
                  pathname === href ||
                  pathname.startsWith(
                    `${href}/`,
                  );

                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />

                    {label}
                  </Link>
                );
              },
            )}
          </nav>
        </aside>

        {/* MAIN CONTENT */}

        <main className="min-w-0">
          {children}
        </main>
      </div>

      {/* MOBILE NAVIGATION */}

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-background lg:hidden">
        {nav.map(
          ([href, label, Icon]) => {
            const active =
              pathname === href ||
              pathname.startsWith(
                `${href}/`,
              );

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-2 text-[11px]",
                  active
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />

                {label}
              </Link>
            );
          },
        )}
      </nav>
    </div>
  );
}