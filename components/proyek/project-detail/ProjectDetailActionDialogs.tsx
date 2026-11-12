import { LoaderCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DocumentLinks } from "@/components/common/DocumentLinks";
import { DocumentUploadField } from "@/components/common/DocumentUploadField";
import { formatDate, humanizeStatus } from "@/lib/hris/format";
import type { ProjectDetail, ProjectExtensionRow } from "./types";

export type ProjectWorkflowAction = "layanan" | "umum" | "pimpinan" | "notulen" | "bast" | null;

export function ProjectDetailActionDialogs({ project, workflow, setWorkflow, approved, setApproved, requestRevision, setRequestRevision, note, setNote, file, setFile, actionError, workflowPending, submitWorkflow, extensionOpen, setExtensionOpen, projectEndDate, extensionEndDate, setExtensionEndDate, extensionReason, setExtensionReason, extensionFile, setExtensionFile, extensionError, extensionPending, submitExtension, reviewingExtension, setReviewingExtension, extensionApproved, setExtensionApproved, extensionReviewNote, setExtensionReviewNote, extensionReviewError, extensionReviewPending, submitExtensionReview }: {
  project: ProjectDetail;
  workflow: ProjectWorkflowAction;
  setWorkflow: (value: ProjectWorkflowAction) => void;
  approved: boolean;
  setApproved: (value: boolean) => void;
  requestRevision: boolean;
  setRequestRevision: (value: boolean) => void;
  note: string;
  setNote: (value: string) => void;
  file: File | null;
  setFile: (value: File | null) => void;
  actionError: string;
  workflowPending: boolean;
  submitWorkflow: () => void;
  extensionOpen: boolean;
  setExtensionOpen: (value: boolean) => void;
  projectEndDate: string;
  extensionEndDate: string;
  setExtensionEndDate: (value: string) => void;
  extensionReason: string;
  setExtensionReason: (value: string) => void;
  extensionFile: File | null;
  setExtensionFile: (value: File | null) => void;
  extensionError: string;
  extensionPending: boolean;
  submitExtension: () => void;
  reviewingExtension: ProjectExtensionRow | null;
  setReviewingExtension: (value: ProjectExtensionRow | null) => void;
  extensionApproved: boolean;
  setExtensionApproved: (value: boolean) => void;
  extensionReviewNote: string;
  setExtensionReviewNote: (value: string) => void;
  extensionReviewError: string;
  extensionReviewPending: boolean;
  submitExtensionReview: () => void;
}) {
  return (
    <>
      <Dialog open={workflow !== null} onOpenChange={(value) => !value && setWorkflow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{workflow === "notulen" ? "Unggah Notulen" : workflow === "bast" ? "Unggah BAST dan Selesaikan Proyek" : `Validasi ${workflow === "layanan" ? "Koordinator Layanan" : workflow === "umum" ? "Bagian Umum" : "Pimpinan"}`}</DialogTitle>
            <DialogDescription>{workflow === "notulen" ? "Unggah PDF, DOC, atau DOCX notulen." : workflow === "bast" ? "Unggah Berita Acara Serah Terima dalam format PDF. Setelah berhasil, status proyek berubah menjadi Selesai." : "Setujui, minta revisi, atau tolak pengajuan. Catatan wajib untuk revisi dan penolakan."}</DialogDescription>
          </DialogHeader>
          {workflow === "notulen" || workflow === "bast" ? (
            <DocumentUploadField label={workflow === "bast" ? "BAST (Berita Acara Serah Terima) · PDF" : "Dokumen Notulen"} accept={workflow === "bast" ? ".pdf" : ".pdf,.doc,.docx"} value={file} onChange={setFile} currentFile={typeof (workflow === "bast" ? project.file_bast : project.file_notulen) === "string" ? String(workflow === "bast" ? project.file_bast : project.file_notulen) : null} />
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="font-medium">{project.nama_proyek || "—"}</p>
                <p className="text-muted-foreground">{project.kode_proyek} · {humanizeStatus(project.status_proyek)}</p>
              </div>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Keputusan validasi</legend>
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${approved ? "border-primary bg-primary/5" : ""}`}>
                  <input type="radio" name="project-detail-validation-decision" checked={approved && !requestRevision} onChange={() => { setApproved(true); setRequestRevision(false); }} className="mt-1 accent-primary" />
                  <span><span className="block text-sm font-medium">Setujui</span><span className="block text-xs text-muted-foreground">Lanjutkan pengajuan ke proses berikutnya.</span></span>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${requestRevision ? "border-amber-400 bg-amber-50" : ""}`}>
                  <input type="radio" name="project-detail-validation-decision" checked={requestRevision} onChange={() => { setApproved(false); setRequestRevision(true); }} className="mt-1 accent-amber-600" />
                  <span><span className="block text-sm font-medium">Minta revisi</span><span className="block text-xs text-muted-foreground">Kembalikan kepada pemilik untuk diperbaiki; riwayat versi disimpan.</span></span>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${!approved && !requestRevision ? "border-destructive bg-destructive/5" : ""}`}>
                  <input type="radio" name="project-detail-validation-decision" checked={!approved && !requestRevision} onChange={() => { setApproved(false); setRequestRevision(false); }} className="mt-1 accent-destructive" />
                  <span><span className="block text-sm font-medium">Tolak</span><span className="block text-xs text-muted-foreground">Akhiri pengajuan dengan alasan yang tercatat.</span></span>
                </label>
              </fieldset>
              <label className="grid gap-1.5 text-sm font-medium">
                Catatan{(!approved || requestRevision) ? <span className="text-destructive">(wajib)</span> : null}
                <textarea rows={3} placeholder={approved ? "Catatan tambahan (opsional)" : requestRevision ? "Tuliskan bagian yang perlu diperbaiki" : "Tuliskan alasan penolakan"} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/40" value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
            </div>
          )}
          {actionError && <Alert variant="destructive"><AlertDescription>{actionError}</AlertDescription></Alert>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkflow(null)}>Batal</Button>
            <Button disabled={workflowPending || ((workflow === "notulen" || workflow === "bast") && !file) || ((workflow === "layanan" || workflow === "umum" || workflow === "pimpinan") && (!approved || requestRevision) && !note.trim())} onClick={submitWorkflow}>
              {workflowPending && <LoaderCircle className="animate-spin" size={16} />}
              {workflow === "bast" ? "Selesaikan Proyek" : workflow === "notulen" ? "Unggah Notulen" : approved ? "Setujui" : requestRevision ? "Minta Revisi" : "Tolak Pengajuan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={extensionOpen} onOpenChange={(value) => !value && setExtensionOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajukan Perpanjangan Masa SK</DialogTitle>
            <DialogDescription>Ajukan sebelum tanggal akhir SK saat ini. Persetujuan hanya mengubah tanggal akhir SK, tanpa mengubah nilai kontrak atau alokasi RO.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/40 p-3 text-sm"><p className="font-medium">{project.nama_proyek}</p><p className="text-muted-foreground">Akhir SK saat ini: {formatDate(projectEndDate)}</p></div>
            <label className="grid gap-1.5 text-sm font-medium">Tanggal akhir SK yang baru<Input type="date" min={projectEndDate} value={extensionEndDate} onChange={(event) => setExtensionEndDate(event.target.value)} /></label>
            <label className="grid gap-1.5 text-sm font-medium">Alasan perpanjangan<textarea rows={4} maxLength={1000} value={extensionReason} onChange={(event) => setExtensionReason(event.target.value)} placeholder="Jelaskan alasan dan pekerjaan yang masih perlu diselesaikan." className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/40" /><span className="text-xs font-normal text-muted-foreground">{extensionReason.length}/1000 karakter</span></label>
            <DocumentUploadField label="Dokumen pendukung perpanjangan (PDF)" accept=".pdf" value={extensionFile} onChange={setExtensionFile} />
            {extensionError && <Alert variant="destructive"><AlertDescription>{extensionError}</AlertDescription></Alert>}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={extensionPending} onClick={() => setExtensionOpen(false)}>Batal</Button>
            <Button disabled={extensionPending} onClick={submitExtension}>{extensionPending && <LoaderCircle className="animate-spin" size={16} />} Kirim ke KARWAS</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewingExtension !== null} onOpenChange={(value) => !value && setReviewingExtension(null)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>Tinjau Perpanjangan SK Proyek</DialogTitle><DialogDescription>Periksa alasan dan dokumen. Jika disetujui, tanggal akhir SK proyek akan diperbarui.</DialogDescription></DialogHeader>
          {reviewingExtension && <div className="space-y-4">
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{project.nama_proyek}</p>
              <p className="mt-1 text-muted-foreground">{formatDate(reviewingExtension.berakhir_sk_sebelumnya)} → <span className="font-semibold text-foreground">{formatDate(reviewingExtension.berakhir_sk_baru)}</span></p>
              <p className="mt-3 whitespace-pre-wrap">{reviewingExtension.alasan}</p>
              <div className="mt-3"><DocumentLinks documents={[{ label: "Dokumen pendukung perpanjangan", path: reviewingExtension.file_dokumen }]} columns={1} /></div>
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Keputusan KARWAS</legend>
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${extensionApproved ? "border-primary bg-primary/5" : ""}`}><input type="radio" name="project-extension-decision" checked={extensionApproved} onChange={() => setExtensionApproved(true)} className="mt-1 accent-primary" /><span><span className="block text-sm font-medium">Setujui</span><span className="block text-xs text-muted-foreground">Perbarui tanggal akhir SK proyek.</span></span></label>
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${!extensionApproved ? "border-destructive bg-destructive/5" : ""}`}><input type="radio" name="project-extension-decision" checked={!extensionApproved} onChange={() => setExtensionApproved(false)} className="mt-1 accent-destructive" /><span><span className="block text-sm font-medium">Tolak</span><span className="block text-xs text-muted-foreground">Tanggal akhir SK tetap seperti saat ini.</span></span></label>
            </fieldset>
            <label className="grid gap-1.5 text-sm font-medium">Catatan pemeriksa{!extensionApproved && <span className="text-destructive"> (wajib saat menolak)</span>}<textarea rows={3} value={extensionReviewNote} onChange={(event) => setExtensionReviewNote(event.target.value)} placeholder={extensionApproved ? "Catatan tambahan (opsional)" : "Tuliskan alasan penolakan"} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/40" /></label>
            {extensionReviewError && <Alert variant="destructive"><AlertDescription>{extensionReviewError}</AlertDescription></Alert>}
          </div>}
          <DialogFooter>
            <Button variant="outline" disabled={extensionReviewPending} onClick={() => setReviewingExtension(null)}>Batal</Button>
            <Button disabled={extensionReviewPending} onClick={submitExtensionReview}>{extensionReviewPending && <LoaderCircle className="animate-spin" size={16} />} Proses keputusan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
