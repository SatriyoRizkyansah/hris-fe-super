import { cn } from "cn";
import type { ReactNode } from "react";

type EmptyDataProps = {
  label?: string;
  className?: string;
  action?: ReactNode;
  compact?: boolean;
};

export function EmptyData({ label = "Belum ada data", className, action, compact = false }: EmptyDataProps) {
  return (
    <div className={cn(`flex flex-col items-center justify-center overflow-hidden bg-background text-center ${compact ? "min-h-0 rounded-md p-3" : "min-h-56 rounded-xl border border-dashed border-border p-8"}`, className)} role="status">
      {!compact && (
        <div className="empty-pyramid" aria-hidden="true">
          <div className="empty-pyramid-wrapper">
            <span className="empty-pyramid-side empty-pyramid-side-1" />
            <span className="empty-pyramid-side empty-pyramid-side-2" />
            <span className="empty-pyramid-side empty-pyramid-side-3" />
            <span className="empty-pyramid-side empty-pyramid-side-4" />
            <span className="empty-pyramid-shadow" />
          </div>
        </div>
      )}
      <p className={cn(compact ? "text-xs font-medium text-muted-foreground" : "mt-2 text-sm font-medium text-muted-foreground")}>{label}</p>
      {action ? <div className={compact ? "mt-1" : "mt-2"}>{action}</div> : null}
    </div>
  );
}
