import Link from "next/link";
import { ArrowLeft, FileClock, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ProjectFinalReportButton } from "@/components/proyek/ProjectFinalReportButton";
import { formatDate, projectStatusLabel, projectStatusTone } from "@/lib/hris/format";
import type { ProjectDetail } from "./types";

export function ProjectDetailHeader({
  project,
  status,
  hasActions,
  canExtend,
  pendingExtension,
  isSubmitter,
  onExtend,
  onWorkflow,
}: {
  project: ProjectDetail;
  status: string;
  hasActions: boolean;
  canExtend: boolean;
  pendingExtension: boolean;
  isSubmitter: boolean;
  onExtend: () => void;
  onWorkflow: (action: "bast") => void;
}) {
  return (
    <header className="space-y-4 rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Button variant="ghost" size="sm" className="mb-2" render={<Link href="/dashboard/proyek" />}>
            <ArrowLeft size={16} /> Semua Proyek
          </Button>
          <h1 className="text-2xl font-bold">{project.nama_proyek || "Menunggu nama proyek dari DPM utama"}</h1>
          {project.nama_client && <p className="text-sm text-muted-foreground">Klien: {project.nama_client}</p>}
          <p className="text-sm text-muted-foreground">Tahun {project.tahun_fiscal} | Diajukan {formatDate(project.created_at)}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {project.nomor_order_pilt && <span className="rounded-md bg-muted px-2.5 py-1.5">Nomor order: {project.nomor_order_pilt}</span>}
            {project.no_kontrak && <span className="rounded-md bg-muted px-2.5 py-1.5">Nomor kontrak: {String(project.no_kontrak)}</span>}
            {(project.mulai_kontrak || project.berakhir_kontrak) && (
              <span className="rounded-md bg-muted px-2.5 py-1.5">
                Periode kontrak: {project.mulai_kontrak ? formatDate(String(project.mulai_kontrak)) : "Belum diatur"} - {project.berakhir_kontrak ? formatDate(String(project.berakhir_kontrak)) : "Belum diatur"}
              </span>
            )}
          </div>
          {project.unit_terlibat?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {project.unit_terlibat.map((unit) => (
                <span key={unit.id} className={`rounded-full px-2.5 py-1 text-xs ${unit.peran === "PENGUSUL" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {unit.nama_unit}{unit.peran === "PENGUSUL" ? " | DPM utama" : " | Kolaborator"}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center">
          <StatusBadge status={projectStatusTone(status)}>{projectStatusLabel(status)}</StatusBadge>
        </div>
      </div>
      {(hasActions || status !== "MENUNGGU_ALOKASI_DPM") && <div className="border-t border-border pt-3">
        {hasActions && (
          <>
            <div className="mb-3">
              <p className="text-sm font-semibold">Tindakan proyek</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Ajukan perpanjangan masa kontrak atau unggah BAST untuk menyelesaikan proyek.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canExtend && (
                <Button type="button" size="sm" variant="outline" onClick={onExtend}>
                  <FileClock size={15} /> Ajukan perpanjangan kontrak
                </Button>
              )}
              {isSubmitter && status === "DISETUJUI_PIMPINAN" && (
                <Button type="button" size="sm" onClick={() => onWorkflow("bast")}>
                  <Upload size={15} /> Unggah BAST untuk menyelesaikan
                </Button>
              )}
              {pendingExtension && isSubmitter && <span className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">Perpanjangan kontrak sedang diperiksa KARWAS</span>}
            </div>
          </>
        )}
        {status !== "MENUNGGU_ALOKASI_DPM" && <div className={`${hasActions ? "mt-3 border-t border-border pt-3" : ""} flex flex-wrap items-center justify-between gap-2`}>
          <span className="text-xs font-medium text-muted-foreground">Laporan proyek</span>
          <ProjectFinalReportButton project={project} />
        </div>}
      </div>}
    </header>
  );
}
