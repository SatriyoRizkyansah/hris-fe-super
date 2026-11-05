"use client";

import {
  BriefcaseBusiness,
  ClipboardCheck,
  FileUp,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import {
  WorkflowDiagram,
  type WorkflowAction,
  type WorkflowStage,
} from "@/components/common/WorkflowDiagram";

export type ProjectWorkflowAction = WorkflowAction;

const stages: WorkflowStage[] = [
  {
    title: "Ajukan proyek",
    owner: "KOORDINATOR PENGUSUL",
    icon: BriefcaseBusiness,
    color: "sky",
    summary: "Isi informasi proyek, unit terlibat, RO awal, dan rencana termin.",
    result: "Menunggu pemeriksaan layanan",
    next: "Versi pengajuan dikunci dan diteruskan ke Koordinator Layanan.",
  },
  {
    title: "Tinjau rencana proyek",
    owner: "KOORDINATOR LAYANAN",
    icon: ShieldCheck,
    color: "violet",
    summary: "Periksa ruang lingkup pekerjaan dan rencana RO sebelum rapat.",
    result: "Menunggu pemeriksaan Koordinator Layanan",
    next: "Jika perlu perbaikan, pengajuan dikembalikan dengan alasan dan riwayat revisi.",
  },
  {
    title: "Rapat dan notulen",
    owner: "KOORDINATOR LAYANAN",
    icon: UsersRound,
    color: "amber",
    summary: "Catat hasil pembahasan dan unggah notulen resmi rapat proyek.",
    result: "Menunggu notulen",
    next: "Notulen meneruskan proyek ke pemeriksaan administrasi dan anggaran.",
  },
  {
    title: "Validasi anggaran",
    owner: "BAGIAN UMUM",
    icon: ClipboardCheck,
    color: "indigo",
    summary: "Tinjau kelengkapan administrasi, sumber dana, dan rencana biaya.",
    result: "Menunggu validasi Bagian Umum",
    next: "Jika sesuai, usulan diteruskan kepada Pimpinan untuk keputusan akhir.",
  },
  {
    title: "Persetujuan dan pelaksanaan",
    owner: "PIMPINAN · PEMILIK PROYEK",
    icon: FileUp,
    color: "emerald",
    summary: "Persetujuan mengaktifkan RO; pemilik menutup proyek dengan BAST.",
    result: "Berjalan hingga BAST",
    next: "Setelah disetujui, pelaksanaan dan transaksi mengikuti modul keuangan. Unggah BAST di detail proyek saat pekerjaan selesai.",
  },
];

export function ProjectWorkflowDiagram({
  actions,
}: {
  actions: ProjectWorkflowAction[];
}) {
  return (
    <WorkflowDiagram
      title="Alur proyek"
      description="Tinjau tahapan, penanggung jawab, dan aksi yang tersedia untuk setiap proses."
      stages={stages}
      actions={actions}
      footerNote="Pemeriksa dapat meminta revisi dengan alasan; setiap pengajuan ulang menyimpan riwayat. RO aktif setelah persetujuan Pimpinan, sedangkan proyek selesai setelah BAST diunggah."
    />
  );
}
