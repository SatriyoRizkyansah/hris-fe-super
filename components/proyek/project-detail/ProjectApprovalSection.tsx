import { Check, Pencil, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ProjectDetail } from "./types";
import { formatDate } from "@/lib/hris/format";

type Workflow = "layanan" | "umum" | "pimpinan" | "notulen" | "bast" | null;

export function ProjectApprovalSection({ project, status, workflowVersion, isLayanan, isUmum, isNotulenUploader, isSubmitter, isRevisionPending, isPimpinan, onWorkflow, onRevision }: {
  project: ProjectDetail;
  status: string;
  workflowVersion: number;
  isLayanan: boolean;
  isUmum: boolean;
  isNotulenUploader: boolean;
  isSubmitter: boolean;
  isRevisionPending: boolean;
  isPimpinan: boolean;
  onWorkflow: (action: Exclude<Workflow, null>) => void;
  onRevision: () => void;
}) {
  const steps = workflowVersion >= 2
    ? ["Pengajuan proyek", "Pemeriksaan Koordinator Layanan", "Rapat dan unggah notulen", "Validasi Bagian Umum", "Persetujuan Pimpinan", "Pelaksanaan dan BAST"]
    : ["Pengajuan proyek", "Validasi Bagian Umum", "Unggah notulen", "Persetujuan Pimpinan", "Pelaksanaan dan BAST"];
  const currentIndex = workflowVersion >= 2
    ? status === "MENUNGGU_VALIDASI_LAYANAN" || status === "PERLU_REVISI_LAYANAN" ? 1
      : status === "MENUNGGU_NOTULEN" ? 2
      : status === "MENUNGGU_VALIDASI_UMUM" || status === "PERLU_REVISI_UMUM" ? 3
      : status === "MENUNGGU_VALIDASI_PIMPINAN" || status === "PERLU_REVISI_PIMPINAN" ? 4
      : status === "DISETUJUI_PIMPINAN" ? 5
      : status === "SELESAI" ? 6 : 0
    : status === "MENUNGGU_VALIDASI_UMUM" || status === "PERLU_REVISI_UMUM" ? 1
      : status === "MENUNGGU_NOTULEN" ? 2
      : status === "MENUNGGU_VALIDASI_PIMPINAN" || status === "PERLU_REVISI_PIMPINAN" ? 3
      : status === "DISETUJUI_PIMPINAN" ? 4
      : status === "SELESAI" ? 5 : 0;
  const rejected = status.startsWith("DITOLAK");

  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Status pengajuan</p>
          <p className="text-sm text-muted-foreground">{String(project.catatan_validasi ?? project.catatan_layanan ?? "Belum ada catatan validasi.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isLayanan && status === "MENUNGGU_VALIDASI_LAYANAN" && <Button variant="outline" onClick={() => onWorkflow("layanan")}><Check size={16} /> Tinjau Rencana</Button>}
          {isUmum && status === "MENUNGGU_VALIDASI_UMUM" && <Button variant="outline" onClick={() => onWorkflow("umum")}><Check size={16} /> Validasi Umum</Button>}
          {isNotulenUploader && status === "MENUNGGU_NOTULEN" && <Button variant="outline" onClick={() => onWorkflow("notulen")}><Upload size={16} /> Unggah Notulen</Button>}
          {isPimpinan && status === "MENUNGGU_VALIDASI_PIMPINAN" && <Button variant="outline" onClick={() => onWorkflow("pimpinan")}><Check size={16} /> Validasi Pimpinan</Button>}
          {isSubmitter && isRevisionPending && <Button variant="outline" onClick={onRevision}><Pencil size={16} /> Perbaiki dan Ajukan Ulang</Button>}
        </div>
      </div>
      <div className="mt-5 border-t pt-4">
        <div className="mb-5">
          <p className="text-sm font-semibold">Alur persetujuan proyek</p>
          <p className="text-xs text-muted-foreground">Proses berjalan berurutan. Rencana Operasional (RO) aktif setelah persetujuan pimpinan.</p>
        </div>
        <ol className={`grid grid-cols-1 gap-0 sm:grid-cols-5 ${workflowVersion >= 2 ? "xl:grid-cols-6" : ""}`}>
          {steps.map((step, index) => {
            const complete = !rejected && index < currentIndex;
            const active = !rejected && index === currentIndex && currentIndex < steps.length;
            const color = complete ? "bg-emerald-600" : active ? "bg-primary" : "bg-border";
            return (
              <li key={step} className="relative flex gap-3 pb-5 last:pb-0 sm:flex-col sm:items-center sm:pb-0 sm:text-center">
                {index < steps.length - 1 && <span aria-hidden="true" className={`absolute left-[15px] top-8 h-[calc(100%-1rem)] w-0.5 ${complete ? "bg-emerald-600" : "bg-border"} sm:left-[calc(50%+16px)] sm:top-[15px] sm:h-0.5 sm:w-[calc(100%-32px)]`} />}
                <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${color}`} aria-label={complete ? "Selesai" : active ? "Sedang diproses" : "Menunggu"}>{complete ? <Check size={16} /> : index + 1}</span>
                <span className="pt-1 sm:pt-2">
                  <span className={`block text-sm font-medium leading-snug ${complete ? "text-emerald-800" : active ? "text-foreground" : "text-muted-foreground"}`}>{step}</span>
                  <span className={`mt-1 block text-xs ${complete ? "text-emerald-700" : active ? "text-primary" : "text-muted-foreground"}`}>{complete ? "Selesai" : active ? "Sedang diproses" : "Menunggu"}</span>
                </span>
              </li>
            );
          })}
        </ol>
        {rejected && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">Pengajuan ditolak. Silakan periksa catatan validasi.</p>}
        {isRevisionPending && <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Pengajuan perlu diperbaiki oleh pemilik proyek sebelum masuk kembali ke pemeriksaan Koordinator Layanan.</p>}
        {status === "DISETUJUI_PIMPINAN" && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Proyek berjalan dan RO aktif setelah disetujui Pimpinan.</p>}
        {status === "SELESAI" && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Proyek telah dinyatakan selesai setelah pemilik proyek mengunggah BAST{project.selesai_pada ? ` pada ${formatDate(project.selesai_pada)}` : ""}.</p>}
        <p className="mt-4 text-xs text-muted-foreground">Setelah proyek disetujui, Billing menerbitkan invoice dan Bendahara mencatat pembayaran setelah dana masuk.</p>
      </div>
      {project.riwayat_revisi?.length ? (
        <div className="mt-5 border-t pt-4">
          <h3 className="text-sm font-semibold">Riwayat revisi</h3>
          <ol className="mt-3 space-y-2">
            {project.riwayat_revisi.map((revision) => (
              <li key={revision.id} className="rounded-lg border bg-muted/20 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">Revisi {revision.nomor_revisi} · {revision.tahap === "LAYANAN" ? "Koordinator Layanan" : revision.tahap === "UMUM" ? "Bagian Umum" : "Pimpinan"}</span>
                  <span className="text-xs text-muted-foreground">Diminta {formatDate(revision.diminta_pada)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{revision.alasan}</p>
                {revision.diajukan_ulang_pada && <p className="mt-1 text-xs text-emerald-700">Diajukan ulang {formatDate(revision.diajukan_ulang_pada)}; versi sebelum dan sesudah tersimpan.</p>}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
