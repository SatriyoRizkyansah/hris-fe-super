export type AnyRow = Record<string, unknown>;

export type EditForm = {
  nama_ro: string;
  total_plafon: string;
  no_kontrak: string;
  nomor_job: string;
  unit_kolaborasi_ids: string[];
  pj: string;
  no_sk: string;
  status_ro: "AKTIF" | "NONAKTIF" | "SELESAI";
};

export type TransactionForm = {
  nama_kegiatan: string;
  no_kuitansi: string;
  tanggal: string;
  debit: string;
  kredit: string;
  keterangan: string;
};

export type SpendRequestForm = {
  nama_kegiatan: string;
  no_kuitansi: string;
  tanggal: string;
  jumlah: string;
  keterangan: string;
};

export type TransactionDirection = "debit" | "kredit";
