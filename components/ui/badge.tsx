import * as React from "react";
import { cn } from "@/lib/utils";
export function Badge({ className, variant = "default", ...props }: React.ComponentProps<"span"> & { variant?: "default" | "success" | "warning" | "danger" | "outline" }) {
  const styles = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    danger: "bg-red-500/10 text-red-700 dark:text-red-300",
    outline: "border border-border text-foreground",
  }[variant];
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", styles, className)} {...props} />;
}
