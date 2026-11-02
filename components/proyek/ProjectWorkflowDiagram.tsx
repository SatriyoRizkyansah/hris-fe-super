"use client";

import { BriefcaseBusiness, ClipboardCheck, FileUp, ReceiptText, ShieldCheck } from "lucide-react";
import { WorkflowDiagram, type WorkflowAction, type WorkflowStage } from "@/components/common/WorkflowDiagram";

export type ProjectWorkflowAction = WorkflowAction;

const stages: WorkflowStage[] = [
  {
    title: "Ajukan proyek",
    owner: "KOORDINATOR",
    icon: BriefcaseBusiness,
    color: "sky",
    summary: "Isi informasi proyek, unit terlibat, RO awal, dan rencana termin.",
    result: "MENUNGGU_VALIDASI_UMUM",
    next: "Pengajuan masuk ke antrean pemeriksaan Koordinator Umum.",
  },
  {
    title: "Validasi Koordinator Umum",
    owner: "KOORDINATOR UMUM",
    icon: ShieldCheck,
    color: "violet",
    summary: "Periksa kelengkapan usulan dan kesesuaian administrasi proyek.",
    result: "MENUNGGU_NOTULEN",
    next: "Jika disetujui, koordinator pengusul melengkapi notulen. Jika ditolak, status menjadi DITOLAK_UMUM.",
  },
  {
    title: "Unggah notulen",
    owner: "KOORDINATOR PENGUSUL",
    icon: FileUp,
    color: "amber",
    summary: "Unggah notulen sebagai dokumen pendukung setelah validasi awal.",
    result: "MENUNGGU_VALIDASI_PIMPINAN",
    next: "Setelah file notulen tersimpan, proyek diteruskan ke antrean Pimpinan.",
  },
  {
    title: "Persetujuan Pimpinan",
    owner: "PIMPINAN",
    icon: ClipboardCheck,
    color: "indigo",
    summary: "Tinjau proyek dan dokumen sebelum memberikan keputusan akhir.",
    result: "DISETUJUI_PIMPINAN",
    next: "Jika ditolak, status menjadi DITOLAK_PIMPINAN. Jika disetujui, RO proyek menjadi aktif.",
  },
  {
    title: "RO aktif & pelaksanaan",
    owner: "UNIT / BILLING / BENDAHARA",
    icon: ReceiptText,
    color: "emerald",
    summary: "Unit menjalankan RO; tagihan termin dan penerimaan diproses melalui modul keuangan.",
    result: "DISETUJUI_PIMPINAN / RO AKTIF",
    next: "Billing menerbitkan invoice termin dan Bendahara mencatat penerimaan pada alur Penagihan/Invoice.",
  },
];

export function ProjectWorkflowDiagram({ actions }: { actions: ProjectWorkflowAction[] }) {
  return <WorkflowDiagram
    title="Alur proyek"
    description="Pilih tahap untuk melihat penanggung jawab dan hasilnya, atau gunakan tombol pada tahap untuk memulai aksinya."
    stages={stages}
    actions={actions}
    footerNote="Penolakan dapat terjadi pada validasi Koordinator Umum atau Pimpinan. Penerbitan invoice termin dan pencatatan pembayaran dilanjutkan di modul Penagihan/Invoice setelah proyek disetujui."
  />;
}
