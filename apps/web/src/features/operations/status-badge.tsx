import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  children: string;
};

export function StatusBadge({ children }: StatusBadgeProps) {
  const value = children.toLowerCase();
  const className = value.includes("enabled") || value.includes("active") || value.includes("succeeded") || value.includes("success")
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : value.includes("disabled") || value.includes("failed") || value.includes("dead")
      ? "bg-destructive/10 text-destructive"
      : value.includes("running") || value.includes("pending")
        ? "bg-primary/10 text-primary"
        : "bg-muted text-muted-foreground";

  return <span className={cn("inline-flex rounded-md px-2 py-1 text-xs font-medium", className)}>{children}</span>;
}

export function EmptyState({ text }: { text: string }) {
  return <div className="p-8 text-sm text-muted-foreground">{text}</div>;
}

export function ErrorState({ text }: { text: string }) {
  return <div className="p-8 text-sm text-destructive">{text}</div>;
}
