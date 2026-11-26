"use client";

import {
  BriefcaseBusiness,
  ClipboardCheck,
  CheckCircle2,
  FileUp,
  ShieldCheck,
  UsersRound,
  PackageCheck,
} from "lucide-react";
import {
  WorkflowDiagram,
  type WorkflowAction,
  type WorkflowStage,
} from "@/components/common/WorkflowDiagram";

export type ProjectWorkflowAction = WorkflowAction;

const stages: WorkflowStage[] = [
  {
    title: "Inisiasi proyek",
    owner: "PILT",
    icon: BriefcaseBusiness,
    color: "sky",
    summary: "Catat nomor order dan informasi induk proyek, lalu tentukan DPM yang terlibat.",
    result: "Menunggu alokasi DPM",
    next: "Proyek induk disiapkan dan setiap DPM yang terlibat mendapat bagian untuk diisi.",
  },
  {
    title: "Isi Job dan RO",
    owner: "UNIT DPM",
    icon: PackageCheck,
    color: "violet",
    summary: "Setiap DPM mengisi Job, MAK, plafon, dan RO yang menjadi tanggung jawabnya.",
    result: "Menunggu alokasi lengkap",
    next: "Setelah seluruh DPM mengirim alokasinya dan jumlah RO seimbang dengan direct cost, PILT meneruskan proyek ke pemeriksaan.",
  },
  {
    title: "Tinjau rencana proyek",
    owner: "KOORDINATOR LAYANAN",
    icon: ShieldCheck,
    color: "violet",
    summary: "Periksa ruang lingkup pekerjaan dan alokasi RO sebelum rapat.",
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
    title: "Persetujuan Pimpinan",
    owner: "PIMPINAN",
    icon: CheckCircle2,
    color: "emerald",
    summary: "Pimpinan meninjau usulan dan dokumen sebelum memberikan keputusan akhir.",
    result: "RO aktif setelah disetujui",
    next: "Setelah disetujui, RO aktif dan proyek masuk ke tahap pelaksanaan.",
  },
  {
    title: "Pelaksanaan dan BAST",
    owner: "PEMILIK PROYEK",
    icon: FileUp,
    color: "emerald",
    summary: "Jalankan proyek dan unggah BAST setelah pekerjaan selesai.",
    result: "Proyek selesai",
    next: "Transaksi mengikuti modul keuangan. Pemilik proyek menutup proyek dengan mengunggah BAST di halaman detail.",
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
