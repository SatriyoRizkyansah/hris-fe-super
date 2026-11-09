import type { RoInputDto, TerminInputDto } from "@/lib/api/generated/api-generated";

export type ProjectForm = {
  kode_proyek: string;
  nama_proyek: string;
  tahun_fiscal: string;
  mulai_kontrak: string;
  berakhir_kontrak: string;
  sumber_pendanaan: string;
  nama_client: string;
  no_kontrak: string;
  pj_1: string;
  pj_2: string;
  nilai_kontrak: string;
  total_direct_cost: string;
  total_margin: string;
};

export type KategoriJob = "LABORATORIUM" | "STUDI" | "KAJIAN" | "DOMINAN_LAB" | "DOMINAN_STUDI";
export type JobMetadataField = "nama_job" | "kategori_job";

export type RoDraft = RoInputDto & {
  id?: string;
  key: string;
  plafonText: string;
  detailMode: "detail" | "later";
  no_kontrak: string;
  pj: string;
};

export type JobDraft = {
  id?: string;
  key: string;
  /** Existing number is displayed read-only; new numbers are issued by the backend. */
  nomor_job?: string;
  nomor_job_reservasi_id?: string;
  nama_job: string;
  kategori_job: KategoriJob | "";
  ros: RoDraft[];
};
export type TerminDraft = TerminInputDto & { id?: string; key: string; persentaseText: string };
