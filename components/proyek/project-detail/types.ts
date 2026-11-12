import type { ProyekItemDto } from "@/lib/api/generated/api-generated";
import type { JobDraft } from "@/components/proyek/project-form.types";

export type ProjectDetailRow = Record<string, unknown>;
export type ProjectRevisionRow = {
  id: string;
  nomor_revisi: number;
  tahap: string;
  alasan: string;
  diminta_oleh_id: string;
  diminta_pada: string;
  diajukan_ulang_oleh_id?: string | null;
  diajukan_ulang_pada?: string | null;
};
export type ProjectExtensionRow = {
  id: string;
  berakhir_sk_sebelumnya: string;
  berakhir_sk_baru: string;
  alasan: string;
  file_dokumen: string;
  status: string;
  diajukan_pada: string;
  diajukan_oleh?: { nama?: string } | null;
  diperiksa_pada?: string | null;
  diperiksa_oleh?: { nama?: string } | null;
  catatan_pemeriksa?: string | null;
};
export type ProjectDetail = ProyekItemDto & {
  file_bast?: string | null;
  selesai_oleh_id?: string | null;
  selesai_pada?: string | null;
  perpanjangan_list?: ProjectExtensionRow[];
  alur_proyek_version?: number;
  riwayat_revisi?: ProjectRevisionRow[];
  catatan_layanan?: string | null;
  divalidasi_layanan_pada?: string | null;
  job_list?: Array<{
    id: string;
    nomor_job: string;
    nama_job?: string | null;
    kategori_job?: JobDraft["kategori_job"] | null;
    ro_list: Array<{
      id: string;
      nama_ro: string;
      mak_id?: string | null;
      mak?: { id?: string; kode_mak?: string; nama_mak?: string } | null;
      id_unit_koordinator: string;
      rekening_id?: string | null;
      plafon: number;
      no_kontrak?: string | null;
      pj?: string | null;
      unit_kolaborasi_ids?: string[];
    }>;
  }>;
  ro_list?: Array<{
    id: string;
    job_proyek_id?: string | null;
    nomor_job?: string | null;
    nama_job?: string | null;
    kategori_job?: JobDraft["kategori_job"] | null;
    nama_ro: string;
    mak_id?: string | null;
    mak?: { id?: string; kode_mak?: string; nama_mak?: string } | null;
    id_unit_koordinator: string;
    rekening_id?: string | null;
    plafon: number;
    no_kontrak?: string | null;
    pj?: string | null;
    unit_kolaborasi_ids?: string[];
  }>;
  termin_list?: Array<{ id: string; nomor_termin: number; persentase: number; nilai_termin: number; has_invoice?: boolean }>;
  unit_terlibat?: Array<{ id: string; peran?: string; nama_unit?: string }>;
};

