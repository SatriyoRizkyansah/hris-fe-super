import { ExternalLink, FileText } from "lucide-react";
import { cn } from "cn";

export function DocumentLinks({ documents, className }: { documents: Array<{ label: string; path?: unknown }>; className?: string }) {
  const available = documents.filter((item) => typeof item.path === "string" && item.path.length > 0) as Array<{ label: string; path: string }>;
  if (!available.length) return <p className={cn("text-sm text-muted-foreground", className)}>Belum ada dokumen proyek.</p>;
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {available.map(({ label, path }) => {
        const normalized = path
          .replace(/^\/+/, "")
          .replace(/^uploads\//, "")
          .replace(/^api\//, "");
        const href = `${base}/api/${normalized.startsWith("uploaded/") ? normalized : `uploaded/${normalized}`}`;
        return (
          <a key={label} href={href} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-muted/20 p-4 transition-colors hover:bg-muted/50">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <FileText size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
              <span className="block truncate text-sm font-medium">{path.split(/[\\/]/).pop()}</span>
            </span>
            <ExternalLink size={16} className="shrink-0 text-muted-foreground" />
          </a>
        );
      })}
    </div>
  );
}
