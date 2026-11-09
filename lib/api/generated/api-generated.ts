/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface LoginDto {
  /** @example "admin@lemigas.esdm.go.id" */
  email: string;
  /** @example "password123" */
  password: string;
}

export interface AksesItemDto {
  /** @example "eyJhbGciOiJI..." */
  token: string;
  /** @example "Keuangan Billing" */
  akses: string;
  /** @example "KEU_BILLING" */
  role: string;
}

export interface LoginUserDto {
  /** @example "012ace5b-e8fe-4411-8d05-deb79e2979ae" */
  id_pegawai: string;
  /** @example "Ahmad Fauzi" */
  nama: string;
  /** @example "https://example.com/photo.jpg" */
  foto: string;
  akses: AksesItemDto[];
}

export interface StandartResponse {
  /** @example 200 */
  status: number;
  /** @example "ok" */
  message: string;
}

export interface UnitKerjaRingkasDto {
  id: string;
  kode_unit: string;
  nama_unit: string;
  tipe_unit: string;
  parent_unit_id?: object | null;
  kepala_unit_nama?: object | null;
}

export interface PegawaiItemDto {
  id: string;
  nip_nik: string;
  nama: string;
  tipe_pegawai: string;
  jabatan?: object | null;
  email?: object | null;
  telepon?: object | null;
  /** @format date-time */
  tanggal_mulai: string;
  status_aktif: string;
  bidang_keahlian?: object | null;
  kontrak_mulai?: object | null;
  kontrak_selesai?: object | null;
  ta_kategori?: string;
  gaji_bulanan?: object | null;
  unit_kerja?: UnitKerjaRingkasDto | null;
  /** @format date-time */
  created_at?: string;
  /** @format date-time */
  updated_at?: string;
}

export interface SkRiwayatItemDto {
  id: string;
  nomor_sk: string;
  /** @format date-time */
  tanggal_sk: string;
  /** @format date-time */
  tanggal_efektif: string;
  tanggal_selesai?: object | null;
  jabatan?: object | null;
  file_sk?: object | null;
  status_aktif: string;
  unit_kerja?: UnitKerjaRingkasDto;
}

export interface PegawaiDetailDto {
  id: string;
  nip_nik: string;
  nama: string;
  tipe_pegawai: string;
  jabatan?: object | null;
  email?: object | null;
  telepon?: object | null;
  /** @format date-time */
  tanggal_mulai: string;
  status_aktif: string;
  bidang_keahlian?: object | null;
  kontrak_mulai?: object | null;
  kontrak_selesai?: object | null;
  ta_kategori?: string;
  gaji_bulanan?: object | null;
  unit_kerja?: UnitKerjaRingkasDto | null;
  /** @format date-time */
  created_at?: string;
  /** @format date-time */
  updated_at?: string;
  riwayat_sk: SkRiwayatItemDto[];
}

export interface StandartResponseCreate {
  /** @example 201 */
  status: number;
  /** @example "created" */
  message: string;
}

export interface CreatePegawaiDto {
  /** @example "197001011990031001" */
  nip_nik: string;
  /** @example "Budi Santoso" */
  nama: string;
  /** @example "TA" */
  tipe_pegawai: "PNS" | "ASN" | "OUTSOURCING" | "TA";
  /** @example "Analis Migas" */
  jabatan?: string;
  /** @example "budi@lemigas.esdm.go.id" */
  email?: string;
  /** @example "081234567890" */
  telepon?: string;
  /** @example "2024-01-01" */
  tanggal_mulai: string;
  /** @default "AKTIF" */
  status_aktif?: "AKTIF" | "NONAKTIF";
  /** @example "Geofisika" */
  bidang_keahlian?: string;
  /** @example "2024-01-01" */
  kontrak_mulai?: string;
  /** @example "2026-12-31" */
  kontrak_selesai?: string;
  /**
   * Kategori TA: BIASA atau RO
   * @default "BIASA"
   */
  ta_kategori?: "BIASA" | "RO";
}

export interface UpdatePegawaiDto {
  /** @example "Budi Santoso" */
  nama?: string;
  tipe_pegawai?: "PNS" | "ASN" | "OUTSOURCING" | "TA";
  /** @example "Analis Migas" */
  jabatan?: string;
  /** @example "budi@lemigas.esdm.go.id" */
  email?: string;
  /** @example "081234567890" */
  telepon?: string;
  status_aktif?: "AKTIF" | "NONAKTIF";
  /** @example "Geofisika" */
  bidang_keahlian?: string;
  /** @example "2024-01-01" */
  kontrak_mulai?: string;
  /** @example "2026-12-31" */
  kontrak_selesai?: string;
  ta_kategori?: "BIASA" | "RO";
}

export interface UnitKerjaItemDto {
  id: string;
  kode_unit: string;
  nama_unit: string;
  tipe_unit: string;
  parent_unit_id?: object | null;
  id_kepala_unit?: object | null;
  kepala_unit_nama?: object | null;
  deskripsi?: object | null;
  status_aktif: string;
  jumlah_pegawai_aktif?: number;
  jumlah_sub_unit?: number;
  /** @format date-time */
  created_at?: string;
  /** @format date-time */
  updated_at?: string;
}

export interface UnitKerjaTreeNodeDto {
  id: string;
  kode_unit: string;
  nama_unit: string;
  tipe_unit: string;
  kepala_unit_nama?: object | null;
  status_aktif: string;
  children?: UnitKerjaTreeNodeDto[];
}

export interface CreateUnitKerjaDto {
  /** @example "KOOR-01" */
  kode_unit: string;
  /** @example "Koordinator Sumber Daya Manusia" */
  nama_unit: string;
  /** @example "KOORDINATOR" */
  tipe_unit: "KOORDINATOR" | "SUB_KOORDINATOR";
  /** Parent unit (wajib untuk SUB_KOORDINATOR) */
  id_parent_unit?: string;
  /** ID pegawai kepala unit */
  id_kepala_unit?: string;
  /** @example "Bertanggung jawab atas SDM" */
  deskripsi?: string;
}

export interface UpdateUnitKerjaDto {
  nama_unit?: string;
  tipe_unit?: "KOORDINATOR" | "SUB_KOORDINATOR";
  id_parent_unit?: string;
  id_kepala_unit?: string;
  deskripsi?: string;
  status_aktif?: "AKTIF" | "NONAKTIF";
}

export interface ProyekUnitDto {
  id: string;
  kode_unit: string;
  nama_unit: string;
  peran: "PENGUSUL" | "KOLABORATOR";
}

export interface ProyekItemDto {
  id: string;
  kode_proyek: string;
  nama_proyek: string;
  tahun_fiscal: number;
  sumber_pendanaan?: object | null;
  pj_1?: object | null;
  pj_2?: object | null;
  nama_client?: object | null;
  no_kontrak?: object | null;
  unit_terlibat?: ProyekUnitDto[];
  file_sk?: object | null;
  file_rab?: object | null;
  file_notulen?: object | null;
  file_bast?: string | null;
  selesai_oleh_id?: string | null;
  selesai_pada?: string | null;
  /** @example 1000000000 */
  nilai_kontrak?: number;
  /** @example 750000000 */
  total_direct_cost?: number;
  /** @example 250000000 */
  total_margin?: number;
  status_proyek:
    | "MENUNGGU_VALIDASI_UMUM"
    | "MENUNGGU_NOTULEN"
    | "MENUNGGU_VALIDASI_PIMPINAN"
    | "DISETUJUI_PIMPINAN"
    | "SELESAI"
    | "DITOLAK_UMUM"
    | "DITOLAK_PIMPINAN";
  catatan_validasi?: object | null;
  diajukan_oleh_id?: object | null;
  nama_pengaju?: object | null;
  nama_unit_pengaju?: object | null;
  divalidasi_umum_pada?: object | null;
  divalidasi_pimpinan_pada?: object | null;
  jumlah_ro?: number;
  total_plafon_ro?: number;
  /** Posisi kas RO gabungan (penerimaan kas dikurangi realisasi) */
  total_saldo_ro?: number;
  total_penerimaan_kas_ro?: number;
  total_realisasi_ro?: number;
  total_komitmen_ro?: number;
  total_sisa_hak_belanja_ro?: number;
  /** Tanggal mulai kontrak proyek */
  mulai_kontrak?: object | null;
  /** Tanggal akhir kontrak proyek */
  berakhir_kontrak?: object | null;
  /** @format date-time */
  created_at?: string;
  /** @format date-time */
  updated_at?: string;
}

export interface RoInputDto {
  /** ID Master MAK untuk RO */
  mak_id: string;
  /** ID unit koordinator pemilik RO */
  id_unit_koordinator: string;
  /** @example 500000000 */
  plafon: number;
  rekening_id?: string;
  /** @example "KONTRAK/2026/001" */
  no_kontrak?: string;
  /** Unit kerja lain yang terlibat pada RO ini */
  unit_kolaborasi_ids?: string[];
  /** @example "Budi Santoso" */
  pj?: string;
}

export interface JobProyekInputDto {
  /** ID Job untuk mempertahankan data saat revisi */
  id?: string;
  /** ID reservasi nomor Job otomatis untuk Job baru */
  nomor_job_reservasi_id?: string;
  /** @example "Pengujian Rheology" */
  nama_job: string;
  kategori_job: "LABORATORIUM" | "STUDI" | "KAJIAN" | "DOMINAN_LAB" | "DOMINAN_STUDI";
  /** Alokasi RO milik Job ini */
  ro_list: RoInputDto[];
}

export interface TerminInputDto {
  /** @example 1 */
  nomor_termin: number;
  /**
   * Persentase dari nilai kontrak
   * @example 50
   */
  persentase: number;
}

export interface CreateProyekDto {
  /** @example "PRJ-2026-001" */
  kode_proyek: string;
  /** @example "Pengembangan Infrastruktur Migas" */
  nama_proyek: string;
  /** @example 2026 */
  tahun_fiscal: number;
  /** Tanggal mulai kontrak proyek yang berlaku untuk seluruh RO */
  mulai_kontrak?: string;
  /** Tanggal akhir kontrak proyek yang berlaku untuk seluruh RO */
  berakhir_kontrak?: string;
  /** @example "APBN 2026" */
  sumber_pendanaan?: string;
  /** @example "Nama Penanggung Jawab 1" */
  pj_1?: string;
  /** @example "Nama Penanggung Jawab 2" */
  pj_2?: string;
  /** @example "PT Contoh Migas Indonesia" */
  nama_client?: string;
  /** Nomor kontrak bersama untuk seluruh RO proyek */
  no_kontrak?: string;
  /** Unit pengusul proyek; untuk Koordinator harus sama dengan unit pada token */
  unit_pengusul_id?: string;
  /** Unit koordinator yang berkolaborasi dalam proyek */
  unit_kolaborasi_ids?: string[];
  /**
   * Nilai kontrak total
   * @example 1000000000
   */
  nilai_kontrak?: number;
  /**
   * Total direct cost
   * @example 750000000
   */
  total_direct_cost?: number;
  /**
   * Total margin yang akan didistribusikan ke 5 kamar
   * @example 250000000
   */
  total_margin?: number;
  /** Daftar RO awal — total plafon harus = total_direct_cost */
  ro_list?: RoInputDto[];
  /** Job proyek sebagai parent untuk satu atau beberapa alokasi RO */
  job_list: JobProyekInputDto[];
  /** Rencana termin; total persentase harus 100% */
  termin_list: TerminInputDto[];
}

export interface UpdateProyekDto {
  nama_proyek?: string;
  /** @example 2026 */
  tahun_fiscal?: number;
  /** @example "2026-01-01" */
  mulai_kontrak?: string;
  /** @example "2026-12-31" */
  berakhir_kontrak?: string;
  sumber_pendanaan?: string;
  pj_1?: string;
  pj_2?: string;
  nama_client?: string;
  no_kontrak?: string;
  /** @example 1000000000 */
  nilai_kontrak?: number;
  /** @example 750000000 */
  total_direct_cost?: number;
  /** @example 250000000 */
  total_margin?: number;
}

export interface ProyekValidationDto {
  /**
   * True untuk setujui, false untuk tolak
   * @example true
   */
  disetujui: boolean;
  /** @example "Dokumen sudah sesuai" */
  catatan?: string;
}

export interface RoBalanceDto {
  pagu_disetujui: number;
  realisasi: number;
  komitmen_aktif: number;
  sisa_dapat_direservasi: number;
  penerimaan_kas: number;
  posisi_kas: number;
  saldo_talangan: number;
  persentase_pagu: number;
  status_pagu: string;
}

export interface RoItemDto {
  id: string;
  kode_ro: string;
  nama_ro: string;
  tahun_fiscal: number;
  total_plafon: number;
  total_terpakai?: number;
  sisa_saldo?: number;
  balance?: RoBalanceDto;
  status_pencairan?: "BELUM_CAIR" | "SEBAGIAN_CAIR" | "CAIR";
  termin_cair_count?: number;
  termin_sebagian_count?: number;
  termin_total_count?: number;
  id_proyek?: object | null;
  nama_proyek?: object | null;
  id_unit_koordinator?: object | null;
  nama_unit_koordinator?: object | null;
  /** Pengguna memiliki akses ke detail keuangan RO ini */
  can_access_detail?: boolean;
  id_mak?: object | null;
  mak_id?: object | null;
  kode_mak?: object | null;
  nama_mak?: object | null;
  tipe_akun_mak?: object | null;
  id_rekening?: object | null;
  rekening_id?: object | null;
  parent_ro_id?: object | null;
  ro_asal_id?: object | null;
  no_kontrak?: object | null;
  nomor_job?: object | null;
  job_proyek_id?: object | null;
  job_proyek?: object | null;
  nama_job?: string | null;
  kategori_job?: "LABORATORIUM" | "STUDI" | "KAJIAN" | "DOMINAN_LAB" | "DOMINAN_STUDI" | null;
  /** Jumlah RO proyek yang memakai nomor Job sama */
  jumlah_ro_split_nomor_job?: number;
  unit_kolaborasi?: object[];
  pj?: object | null;
  file_rab?: object | null;
  status_ro?: string;
  mulai_kontrak?: object | null;
  berakhir_kontrak?: object | null;
  /** @format date-time */
  created_at?: string;
  /** @format date-time */
  updated_at?: string;
}

export interface RoTransaksiItemDto {
  id: string;
  ro_id: string;
  nama_kegiatan: string;
  no_kuitansi?: object | null;
  /** @format date-time */
  tanggal: string;
  debit: number;
  kredit: number;
  keterangan?: object | null;
  /** @format date-time */
  created_at: string;
}

export interface RoDetailDto {
  id: string;
  kode_ro: string;
  nama_ro: string;
  tahun_fiscal: number;
  total_plafon: number;
  total_terpakai?: number;
  sisa_saldo?: number;
  /** Ringkasan hak belanja dan posisi kas RO */
  balance?: RoBalanceDto;
  status_pencairan?: "BELUM_CAIR" | "SEBAGIAN_CAIR" | "CAIR";
  termin_cair_count?: number;
  termin_sebagian_count?: number;
  termin_total_count?: number;
  id_proyek?: object | null;
  nama_proyek?: object | null;
  id_unit_koordinator?: object | null;
  nama_unit_koordinator?: object | null;
  /** Pengguna memiliki akses ke detail keuangan RO ini */
  can_access_detail?: boolean;
  id_mak?: object | null;
  mak_id?: object | null;
  kode_mak?: object | null;
  nama_mak?: object | null;
  tipe_akun_mak?: object | null;
  id_rekening?: object | null;
  rekening_id?: object | null;
  parent_ro_id?: object | null;
  ro_asal_id?: object | null;
  no_kontrak?: object | null;
  nomor_job?: object | null;
  job_proyek_id?: object | null;
  job_proyek?: object | null;
  /** Jumlah RO proyek yang memakai nomor Job sama */
  jumlah_ro_split_nomor_job?: number;
  unit_kolaborasi?: object[];
  pj?: object | null;
  file_rab?: object | null;
  status_ro?: string;
  mulai_kontrak?: object | null;
  berakhir_kontrak?: object | null;
  /** @format date-time */
  created_at?: string;
  /** @format date-time */
  updated_at?: string;
  transaksi_list: RoTransaksiItemDto[];
  total_debit: number;
  total_kredit: number;
  saldo_ledger: number;
  alokasi_list: object[];
}

export interface CreateRoDto {
  /** ID Master MAK */
  id_mak: string;
  /** ID proyek sumber RO */
  id_proyek: string;
  /** ID unit koordinator pemilik RO */
  id_unit_koordinator: string;
  /** ID rekening fisik sumber saldo RO */
  id_rekening?: string;
  /** @example 2026 */
  tahun_fiscal: number;
  /**
   * Total plafon Rupiah (integer)
   * @example 500000000
   */
  total_plafon: number;
  /** Pilih Job yang telah terdaftar pada proyek untuk menambah RO split */
  job_proyek_id?: string;
  /** Wajib jika membuat Job baru bersama RO ini */
  nama_job?: string;
  kategori_job?: "LABORATORIUM" | "STUDI" | "KAJIAN" | "DOMINAN_LAB" | "DOMINAN_STUDI";
  /** ID reservasi nomor Job otomatis untuk Job baru */
  nomor_job_reservasi_id?: string;
  /** @example "KONTRAK/2026/001" */
  no_kontrak?: string;
  /** Unit kerja lain yang terlibat pada RO ini */
  unit_kolaborasi_ids?: string[];
  /** @example "Budi Santoso" */
  pj?: string;
  /** @default "AKTIF" */
  status_ro?: "AKTIF" | "NONAKTIF" | "SELESAI";
}

export interface UpdateRoDto {
  /** ID Master MAK */
  id_mak?: string;
  /** ID rekening fisik sumber saldo RO */
  id_rekening?: string;
  total_plafon?: number;
  no_kontrak?: string;
  /** Unit kerja lain yang terlibat pada RO ini */
  unit_kolaborasi_ids?: string[];
  pj?: string;
  status_ro?: "AKTIF" | "NONAKTIF" | "SELESAI";
}

export interface CreateRoTransaksiDto {
  /** @example "Beli ATK" */
  nama_kegiatan: string;
  /** @example "KWT-001" */
  no_kuitansi?: string;
  /** @example "2026-01-15" */
  tanggal: string;
  /** @example 1500000 */
  debit?: number;
  /** @example 10000000 */
  kredit?: number;
  keterangan?: string;
}

export interface UpdateRoTransaksiDto {
  nama_kegiatan?: string;
  no_kuitansi?: string;
  tanggal?: string;
  debit?: number;
  kredit?: number;
  keterangan?: string;
}

export interface DanaOperasionalItemDto {
  id: string;
  tahun_fiscal: number;
  total_plafon: number;
  total_terpakai?: number;
  sisa_saldo?: number;
  id_unit_koordinator?: object | null;
  nama_unit_koordinator?: object | null;
  id_rekening?: object | null;
  rekening_id?: object | null;
  kategori_kamar?:
    | "P1_PNS_NON_PNS"
    | "P2_KP3"
    | "OPS_KANTOR"
    | "OPS_KP3"
    | "MULOS_SPI"
    | "LAINNYA";
  /** @format date-time */
  created_at?: string;
  /** @format date-time */
  updated_at?: string;
}

export interface CreateDanaOperasionalDto {
  /** ID unit koordinator pemilik dana operasional */
  id_unit_koordinator: string;
  /** ID rekening fisik sumber saldo dana */
  id_rekening?: string;
  /** @example 2026 */
  tahun_fiscal: number;
  /**
   * Total plafon dana operasional Rupiah (integer)
   * @example 200000000
   */
  total_plafon: number;
  /**
   * Kategori kamar wallet
   * @example "LAINNYA"
   */
  kategori_kamar?:
    | "P1_PNS_NON_PNS"
    | "P2_KP3"
    | "OPS_KANTOR"
    | "OPS_KP3"
    | "MULOS_SPI"
    | "LAINNYA";
}

export interface UpdateDanaOperasionalDto {
  /** ID rekening fisik sumber saldo dana */
  id_rekening?: string;
  /**
   * Total plafon baru Rupiah (integer)
   * @example 250000000
   */
  total_plafon?: number;
}

export interface CreateDanaTransaksiDto {
  /** @example "Beli ATK" */
  nama_kegiatan: string;
  /** @example "KWT-001" */
  no_kuitansi?: string;
  /** @example "2026-01-15" */
  tanggal: string;
  /** @example 1500000 */
  debit?: number;
  /** @example 10000000 */
  kredit?: number;
  keterangan?: string;
}

export interface UpdateDanaTransaksiDto {
  nama_kegiatan?: string;
  no_kuitansi?: string;
  tanggal?: string;
  debit?: number;
  kredit?: number;
  keterangan?: string;
}

export interface SkItemDto {
  id: string;
  nomor_sk: string;
  /** @format date-time */
  tanggal_sk: string;
  /** @format date-time */
  tanggal_efektif: string;
  tanggal_selesai?: object | null;
  jabatan?: object | null;
  file_sk?: object | null;
  gaji_bulanan?: object | null;
  sumber_dana_default?: "RO" | "OPERASIONAL" | null;
  ro_id_default?: object | null;
  dana_operasional_id_default?: object | null;
  /** Homebase (true) atau tugas tambahan (false) */
  is_homebase: boolean;
  keterangan?: object | null;
  status_aktif: string;
  id_pegawai?: object | null;
  nama_pegawai?: object | null;
  nip_nik?: object | null;
  id_unit_kerja?: object | null;
  nama_unit_kerja?: object | null;
  /** @format date-time */
  created_at?: string;
  /** @format date-time */
  updated_at?: string;
}

export interface CreateSkDto {
  /** @example "SK/001/LEMIGAS/2026" */
  nomor_sk: string;
  /** @example "2026-01-01" */
  tanggal_sk: string;
  /** @example "2026-02-01" */
  tanggal_efektif: string;
  /** @example "2026-12-31" */
  tanggal_selesai?: string;
  /** ID pegawai pemegang SK */
  id_pegawai: string;
  /** ID unit kerja tujuan */
  id_unit_kerja: string;
  /** @example "Analis Migas Ahli Muda" */
  jabatan?: string;
  /** File PDF SK (akan diupload via endpoint upload) */
  file_sk?: string;
  /**
   * Gaji bulanan per SK
   * @example 12000000
   */
  gaji_bulanan?: number;
  /** Default sumber dana TA */
  sumber_dana_default?: "RO" | "OPERASIONAL";
  /** Default RO id jika sumber RO */
  ro_id_default?: string;
  /** Default dana operasional id jika sumber OPERASIONAL */
  dana_operasional_id_default?: string;
  /**
   * Tugas tambahan (true = rangkap, false = mutasi/perpanjangan)
   * @default false
   */
  is_tugas_tambahan?: boolean;
  /** Keterangan penempatan */
  keterangan?: string;
}

export interface UpdateSkDto {
  nomor_sk?: string;
  tanggal_sk?: string;
  tanggal_efektif?: string;
  tanggal_selesai?: string;
  id_unit_kerja?: string;
  jabatan?: string;
  file_sk?: string;
  /** @example 12000000 */
  gaji_bulanan?: number;
  sumber_dana_default?: "RO" | "OPERASIONAL";
  ro_id_default?: string;
  dana_operasional_id_default?: string;
}

export interface ActivateSkDto {
  /** Aktifkan (true) atau nonaktifkan (false) SK */
  status: boolean;
}

export interface AlokasiItemDto {
  id: string;
  periode_bulan: number;
  periode_tahun: number;
  sumber_dana: string;
  /** @example 9000000 */
  jumlah: number;
  status: string;
  keterangan?: object | null;
  id_pegawai?: object | null;
  nama_pegawai?: object | null;
  nip_nik?: object | null;
  tipe_pegawai?: object | null;
  gaji_bulanan?: object | null;
  id_unit_kerja?: object | null;
  nama_unit_kerja?: object | null;
  id_ro?: object | null;
  nama_ro?: object | null;
  id_dana_operasional?: object | null;
  nama_dibuat_oleh?: object | null;
  /** @format date-time */
  created_at?: string;
  /** @format date-time */
  updated_at?: string;
}

export interface CreateAlokasiDto {
  /** ID pegawai TA */
  id_pegawai: string;
  /**
   * @min 1
   * @max 12
   * @example 1
   */
  periode_bulan: number;
  /** @example 2026 */
  periode_tahun: number;
  /** @example "RO" */
  sumber_dana: "RO" | "OPERASIONAL";
  /** Wajib jika sumber_dana = RO */
  id_ro?: string;
  /** Wajib jika sumber_dana = OPERASIONAL */
  id_dana_operasional?: string;
  /**
   * Jumlah alokasi Rupiah (integer)
   * @example 9000000
   */
  jumlah: number;
  /** @example "Alokasi gaji TA bulan Januari" */
  keterangan?: string;
}

export interface UpdateAlokasiDto {
  sumber_dana?: "RO" | "OPERASIONAL";
  id_ro?: string;
  id_dana_operasional?: string;
  /** @example 9000000 */
  jumlah?: number;
  keterangan?: string;
}

export interface RekapItemDto {
  id_pegawai: string;
  nama_pegawai: string;
  nip_nik?: object | null;
  nama_unit_kerja?: object | null;
  gaji_bulanan: number;
  total_alokasi: number;
  alokasi_ro: number;
  alokasi_operasional: number;
  sisa_gaji: number;
  detail?: AlokasiItemDto[];
}

export interface UserItemDto {
  id: string;
  email: string;
  nama: string;
  role: string;
  nama_role?: object | null;
  /** @example ["SUPERADMIN","KEUANGAN"] */
  roles: any[][];
  roles_detail?: any[][];
  id_unit_kerja?: object | null;
  nama_unit_kerja?: object | null;
  status: string;
  /** @format date-time */
  created_at?: string;
  /** @format date-time */
  updated_at?: string;
}

export interface CreateUserDto {
  /** @example "koordinator.sdm@lemigas.esdm.go.id" */
  email: string;
  /** @example "Koordinator SDM" */
  nama: string;
  /**
   * @minLength 6
   * @example "password123"
   */
  password: string;
  /** @example "KOORDINATOR" */
  role:
    | "SUPERADMIN"
    | "KOORDINATOR"
    | "SUBKOOR"
    | "KARYAWAN"
    | "KEUANGAN"
    | "KEU_BILLING"
    | "KEU_BENDAHARA"
    | "KEU_KARWAS"
    | "PIMPINAN"
    | "SPI";
  /** Role tambahan selain role default */
  roles?: (
    | "SUPERADMIN"
    | "KOORDINATOR"
    | "SUBKOOR"
    | "KARYAWAN"
    | "KEUANGAN"
    | "KEU_BILLING"
    | "KEU_BENDAHARA"
    | "KEU_KARWAS"
    | "PIMPINAN"
    | "SPI"
  )[];
  /** Unit kerja (koordinator unit aktif) */
  id_unit_kerja?: string;
  /** @default "AKTIF" */
  status?: "AKTIF" | "NONAKTIF";
}

export interface UpdateUserDto {
  nama?: string;
  /** @minLength 6 */
  password?: string;
  /** Role default */
  role?:
    | "SUPERADMIN"
    | "KOORDINATOR"
    | "SUBKOOR"
    | "KARYAWAN"
    | "KEUANGAN"
    | "KEU_BILLING"
    | "KEU_BENDAHARA"
    | "KEU_KARWAS"
    | "PIMPINAN"
    | "SPI";
  /** Daftar role (termasuk default). Jika diisi, akan sync UserRole */
  roles?: (
    | "SUPERADMIN"
    | "KOORDINATOR"
    | "SUBKOOR"
    | "KARYAWAN"
    | "KEUANGAN"
    | "KEU_BILLING"
    | "KEU_BENDAHARA"
    | "KEU_KARWAS"
    | "PIMPINAN"
    | "SPI"
  )[];
  id_unit_kerja?: string;
  status?: "AKTIF" | "NONAKTIF";
}

export type DistributeMarginDto = object;

export type DistribusiMarginSimpleDto = object;

export interface UpdatePengaturanMarginDto {
  /** @example "P1 PNS & Non PNS" */
  nama_kamar?: string;
  /**
   * Persentase 0-100
   * @example 48
   */
  persentase?: number;
  /** Unit koordinator pemilik wallet */
  unit_kerja_id?: string;
  /** Master rekening tujuan distribusi margin */
  rekening_id?: string;
}

export interface CreateMasterRekeningDto {
  /** @example "Bank Mandiri" */
  nama_bank: string;
  /** @example "1010002727772" */
  nomor_rekening: string;
  /** @example "RPL 019 BLU LEMIGAS UNTUK OPS P." */
  nama_rekening: string;
}

export interface UpdateMasterRekeningDto {
  /** @example "Bank Mandiri" */
  nama_bank?: string;
  /** @example "1010002727772" */
  nomor_rekening?: string;
  /** @example "RPL 019 BLU LEMIGAS UNTUK OPS P." */
  nama_rekening?: string;
  /** @example true */
  status_aktif?: boolean;
}

export interface CreateRekonsiliasiBankDto {
  /** ID rekening fisik */
  rekening_id: string;
  /**
   * Saldo rekening koran dalam Rupiah
   * @example 106397603988
   */
  saldo_bank: number;
  /** @example "Pajak belum disetor" */
  keterangan?: string;
  /**
   * Default hari ini
   * @example "2026-10-10"
   */
  tanggal_rekonsiliasi?: string;
  /**
   * Default tahun dari tanggal rekonsiliasi
   * @example 2026
   */
  tahun_fiscal?: number;
}

export interface CreateMasterMakDto {
  /**
   * Kode MAK angka
   * @example "525111"
   */
  kode_mak: string;
  /** @example "Belanja Gaji dan Tunjangan" */
  nama_mak: string;
  /** @example "BELANJA" */
  tipe_akun: "BELANJA" | "PENDAPATAN";
}

export interface UpdateMasterMakDto {
  /** @example "525111" */
  kode_mak?: string;
  /** @example "Belanja Gaji dan Tunjangan" */
  nama_mak?: string;
  tipe_akun?: "BELANJA" | "PENDAPATAN";
  /** @example true */
  status_aktif?: boolean;
}

export interface CreatePengajuanBelanjaDto {
  ro_id: string;
  /** @example "Pembelian bahan pengujian" */
  nama_kegiatan: string;
  /** @example "KWT-001" */
  no_kuitansi?: string;
  /** @example "2026-10-26" */
  tanggal: string;
  /** @example 1500000 */
  jumlah: number;
  keterangan?: string;
}

export interface ReviewPengajuanBelanjaDto {
  disetujui: boolean;
  catatan?: string;
}

export interface BayarPengajuanBelanjaDto {
  /** @example "BAYAR-PB-2026-001" */
  nomor_pembayaran: string;
  /** @example "2026-10-27" */
  tanggal_bayar: string;
  catatan?: string;
}

export interface CreateInvoiceDto {
  jenis: "PROYEK" | "RETAIL";
  termin_id?: string;
  retail_job_id?: string;
  /** @example "INV/2026/001" */
  nomor_invoice: string;
  /** @example "2026-10-26" */
  tanggal_terbit: string;
  /** @example "2026-11-25" */
  tanggal_jatuh_tempo?: string;
}

export interface BayarInvoiceDto {
  mutasi_bank_id: string;
  nominal: number;
  catatan?: string;
}

export interface CreateRetailJobItemDto {
  nama_layanan: string;
  /** ID perconto/sampel sesuai tanda terima. */
  id_sampel?: string;
  parameter_uji?: string;
  metode_uji?: string;
  /** @default "sampel" */
  satuan?: string;
  /** @example 1 */
  jumlah: number;
  /**
   * Tarif per rincian bila dicatat. Nilai tagihan utama disimpan pada nilai layanan order.
   * @example 0
   */
  tarif?: number;
  catatan?: string;
}

export interface CreateRetailJobDto {
  unit_pelaksana_id: string;
  nama_pelanggan: string;
  alamat_pelanggan?: string;
  npwp_pelanggan?: string;
  /**
   * Diisi setelah pengujian selesai.
   * @example "LHU/2026/001"
   */
  nomor_lhu?: string;
  /**
   * Nomor tanda terima perconto saat sampel diterima.
   * @example "TT/2026/001"
   */
  nomor_tanda_terima_perconto: string;
  /** @example "2026-10-30" */
  tanggal_perconto_diterima: string;
  /** @example "2026-10-30" */
  tanggal_permohonan: string;
  /** @example 250000 */
  nilai_layanan: number;
  /** Keterangan layanan atau sampel yang diuji. */
  detail_perconto?: string;
  /** Daftar sampel dan pengujian yang diterima. */
  rincian_layanan?: CreateRetailJobItemDto[];
}

export interface UpdateRetailJobDto {
  nama_pelanggan?: string;
  alamat_pelanggan?: string;
  npwp_pelanggan?: string;
  referensi_kontrak?: string;
  nomor_surat_permohonan?: string;
  tanggal_permohonan?: string;
  nomor_tanda_terima_perconto?: string;
  detail_perconto?: string;
  tanggal_perconto_diterima?: string;
  nomor_lhu?: string;
  tanggal_lhu?: string;
  nilai_layanan?: number;
  status?:
    | "PERMOHONAN_DITERIMA"
    | "PERCONTO_DITERIMA"
    | "PENGUJIAN"
    | "LHU_TERBIT"
    | "SIAP_DITAGIH"
    | "SELESAI"
    | "DIBATALKAN";
  catatan_unit?: string;
}

export interface CreateRetailExpenseDto {
  nama_kegiatan: string;
  no_kuitansi?: string;
  tanggal: string;
  /** @example 350000 */
  jumlah: number;
  keterangan?: string;
}

export interface ReviewRetailExpenseDto {
  disetujui: boolean;
  catatan?: string;
}

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat = keyof Omit<Body, "body" | "bodyUsed">;

export interface FullRequestParams extends Omit<RequestInit, "body"> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseFormat;
  /** request body */
  body?: unknown;
  /** base url */
  baseUrl?: string;
  /** request cancellation token */
  cancelToken?: CancelToken;
}

export type RequestParams = Omit<
  FullRequestParams,
  "body" | "method" | "query" | "path"
>;

export interface ApiConfig<SecurityDataType = unknown> {
  baseUrl?: string;
  baseApiParams?: Omit<RequestParams, "baseUrl" | "cancelToken" | "signal">;
  securityWorker?: (
    securityData: SecurityDataType | null,
  ) => Promise<RequestParams | void> | RequestParams | void;
  customFetch?: typeof fetch;
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown>
  extends Response {
  data: D;
  error: E;
}

type CancelToken = Symbol | string | number;

export enum ContentType {
  Json = "application/json",
  JsonApi = "application/vnd.api+json",
  FormData = "multipart/form-data",
  UrlEncoded = "application/x-www-form-urlencoded",
  Text = "text/plain",
}

export class HttpClient<SecurityDataType = unknown> {
  public baseUrl: string = "";
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
  private abortControllers = new Map<CancelToken, AbortController>();
  private customFetch = (...fetchParams: Parameters<typeof fetch>) =>
    fetch(...fetchParams);

  private baseApiParams: RequestParams = {
    credentials: "same-origin",
    headers: {},
    redirect: "follow",
    referrerPolicy: "no-referrer",
  };

  constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
    Object.assign(this, apiConfig);
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected encodeQueryParam(key: string, value: any) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === "number" ? value : `${value}`)}`;
  }

  protected addQueryParam(query: QueryParamsType, key: string) {
    return this.encodeQueryParam(key, query[key]);
  }

  protected addArrayQueryParam(query: QueryParamsType, key: string) {
    const value = query[key];
    return value.map((v: any) => this.encodeQueryParam(key, v)).join("&");
  }

  protected toQueryString(rawQuery?: QueryParamsType): string {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter(
      (key) => "undefined" !== typeof query[key],
    );
    return keys
      .map((key) =>
        Array.isArray(query[key])
          ? this.addArrayQueryParam(query, key)
          : this.addQueryParam(query, key),
      )
      .join("&");
  }

  protected addQueryParams(rawQuery?: QueryParamsType): string {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : "";
  }

  private contentFormatters: Record<ContentType, (input: any) => any> = {
    [ContentType.Json]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string")
        ? JSON.stringify(input)
        : input,
    [ContentType.JsonApi]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string")
        ? JSON.stringify(input)
        : input,
    [ContentType.Text]: (input: any) =>
      input !== null && typeof input !== "string"
        ? JSON.stringify(input)
        : input,
    [ContentType.FormData]: (input: any) => {
      if (input instanceof FormData) {
        return input;
      }

      return Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(
          key,
          property instanceof Blob
            ? property
            : typeof property === "object" && property !== null
              ? JSON.stringify(property)
              : `${property}`,
        );
        return formData;
      }, new FormData());
    },
    [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
  };

  protected mergeRequestParams(
    params1: RequestParams,
    params2?: RequestParams,
  ): RequestParams {
    return {
      ...this.baseApiParams,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.baseApiParams.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected createAbortSignal = (
    cancelToken: CancelToken,
  ): AbortSignal | undefined => {
    if (this.abortControllers.has(cancelToken)) {
      const abortController = this.abortControllers.get(cancelToken);
      if (abortController) {
        return abortController.signal;
      }
      return void 0;
    }

    const abortController = new AbortController();
    this.abortControllers.set(cancelToken, abortController);
    return abortController.signal;
  };

  public abortRequest = (cancelToken: CancelToken) => {
    const abortController = this.abortControllers.get(cancelToken);

    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(cancelToken);
    }
  };

  public request = async <T = any, E = any>({
    body,
    secure,
    path,
    type,
    query,
    format,
    baseUrl,
    cancelToken,
    ...params
  }: FullRequestParams): Promise<HttpResponse<T, E>> => {
    const secureParams =
      ((typeof secure === "boolean" ? secure : this.baseApiParams.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const queryString = query && this.toQueryString(query);
    const payloadFormatter = this.contentFormatters[type || ContentType.Json];
    const responseFormat = format || requestParams.format;

    return this.customFetch(
      `${baseUrl || this.baseUrl || ""}${path}${queryString ? `?${queryString}` : ""}`,
      {
        ...requestParams,
        headers: {
          ...(requestParams.headers || {}),
          ...(type && type !== ContentType.FormData
            ? { "Content-Type": type }
            : {}),
        },
        signal:
          (cancelToken
            ? this.createAbortSignal(cancelToken)
            : requestParams.signal) || null,
        body:
          typeof body === "undefined" || body === null
            ? null
            : payloadFormatter(body),
      },
    ).then(async (response) => {
      const r = response as HttpResponse<T, E>;
      r.data = null as unknown as T;
      r.error = null as unknown as E;

      const responseToParse = responseFormat ? response.clone() : response;
      const data = !responseFormat
        ? r
        : await responseToParse[responseFormat]()
            .then((data) => {
              if (r.ok) {
                r.data = data;
              } else {
                r.error = data;
              }
              return r;
            })
            .catch((e) => {
              r.error = e;
              return r;
            });

      if (cancelToken) {
        this.abortControllers.delete(cancelToken);
      }

      if (!response.ok) throw data;
      return data;
    });
  };
}

/**
 * @title HRIS LEMIGAS API
 * @version 1.0
 * @contact
 *
 * Dokumentasi API HRIS LEMIGAS - Pengelolaan pegawai, unit kerja dinamis (koordinator/sub-koordinator), SK, RO, dana operasional, dan alokasi gaji TA
 */
export class Api<
  SecurityDataType extends unknown,
> extends HttpClient<SecurityDataType> {
  app = {
    /**
     * No description
     *
     * @tags App
     * @name AppControllerGetHello
     * @request GET:/
     */
    appControllerGetHello: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/`,
        method: "GET",
        ...params,
      }),
  };
  health = {
    /**
     * No description
     *
     * @tags Health
     * @name HealthCheck
     * @summary api health check
     * @request GET:/api/health
     */
    healthCheck: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/health`,
        method: "GET",
        ...params,
      }),
  };
  auth = {
    /**
     * No description
     *
     * @tags Auth
     * @name LoginUser
     * @summary Login user dan dapatkan JWT token
     * @request POST:/api/auth/login
     */
    loginUser: (data: LoginDto, params: RequestParams = {}) =>
      this.request<LoginUserDto, any>({
        path: `/api/auth/login`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Auth
     * @name GetCurrentUser
     * @summary Dapatkan data user dari token JWT
     * @request GET:/api/auth/me
     * @secure
     */
    getCurrentUser: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/auth/me`,
        method: "GET",
        secure: true,
        ...params,
      }),
  };
  masterPegawai = {
    /**
     * No description
     *
     * @tags Master - Pegawai
     * @name PegawaiGetGetDataControllerGetData
     * @summary Get daftar pegawai (Superadmin, Koordinator, Keuangan (Legacy))
     * @request GET:/api/pegawai
     * @secure
     */
    pegawaiGetGetDataControllerGetData: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        tipe_pegawai?: "PNS" | "ASN" | "OUTSOURCING" | "TA";
        status_aktif?: "AKTIF" | "NONAKTIF";
        /** Filter id unit kerja */
        id_unit_kerja?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: PegawaiItemDto[];
          pagination?: {
            /** @example 10 */
            limit?: number;
            /** @example 1 */
            page?: number;
            /** @example 1 */
            total_pages?: number;
            /** @example 1 */
            total_datas?: number;
          };
        },
        void
      >({
        path: `/api/pegawai`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Pegawai
     * @name PegawaiPostControllerCreate
     * @summary Tambah pegawai (Superadmin)
     * @request POST:/api/pegawai
     * @secure
     */
    pegawaiPostControllerCreate: (
      data: CreatePegawaiDto,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponseCreate & {
          data?: PegawaiItemDto;
        },
        void
      >({
        path: `/api/pegawai`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Pegawai
     * @name PegawaiGetGetDetailControllerGetDetail
     * @summary Get detail pegawai (Superadmin, Koordinator, Keuangan (Legacy))
     * @request GET:/api/pegawai/{id}
     * @secure
     */
    pegawaiGetGetDetailControllerGetDetail: (
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: PegawaiDetailDto;
        },
        void
      >({
        path: `/api/pegawai/${id}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Pegawai
     * @name PegawaiPutControllerUpdate
     * @summary Update pegawai (Superadmin)
     * @request PUT:/api/pegawai/{id}
     * @secure
     */
    pegawaiPutControllerUpdate: (
      id: string,
      data: UpdatePegawaiDto,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: PegawaiItemDto;
        },
        void
      >({
        path: `/api/pegawai/${id}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Pegawai
     * @name PegawaiDeleteControllerRemove
     * @summary Nonaktifkan pegawai (Superadmin)
     * @request DELETE:/api/pegawai/{id}
     * @secure
     */
    pegawaiDeleteControllerRemove: (id: string, params: RequestParams = {}) =>
      this.request<void, void>({
        path: `/api/pegawai/${id}`,
        method: "DELETE",
        secure: true,
        ...params,
      }),
  };
  masterUnitKerja = {
    /**
     * No description
     *
     * @tags Master - Unit Kerja
     * @name UnitKerjaGetGetDataControllerGetData
     * @summary Get daftar unit kerja (Superadmin, Koordinator, Keuangan (Legacy))
     * @request GET:/api/unit-kerja
     * @secure
     */
    unitKerjaGetGetDataControllerGetData: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        tipe_unit?: "KOORDINATOR" | "SUB_KOORDINATOR";
        /** Filter parent unit */
        id_parent_unit?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: UnitKerjaItemDto[];
          pagination?: {
            /** @example 10 */
            limit?: number;
            /** @example 1 */
            page?: number;
            /** @example 1 */
            total_pages?: number;
            /** @example 1 */
            total_datas?: number;
          };
        },
        void
      >({
        path: `/api/unit-kerja`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Unit Kerja
     * @name UnitKerjaPostControllerCreate
     * @summary Tambah unit kerja (Superadmin)
     * @request POST:/api/unit-kerja
     * @secure
     */
    unitKerjaPostControllerCreate: (
      data: CreateUnitKerjaDto,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponseCreate & {
          data?: UnitKerjaItemDto;
        },
        void
      >({
        path: `/api/unit-kerja`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Unit Kerja
     * @name UnitKerjaGetGetTreeControllerGetTree
     * @summary Get struktur organisasi (tree) (Superadmin, Koordinator, Keuangan (Legacy))
     * @request GET:/api/unit-kerja/tree
     * @secure
     */
    unitKerjaGetGetTreeControllerGetTree: (params: RequestParams = {}) =>
      this.request<
        StandartResponse & {
          data?: UnitKerjaTreeNodeDto;
        },
        void
      >({
        path: `/api/unit-kerja/tree`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Unit Kerja
     * @name UnitKerjaPutControllerUpdate
     * @summary Update unit kerja (Superadmin)
     * @request PUT:/api/unit-kerja/{id}
     * @secure
     */
    unitKerjaPutControllerUpdate: (
      id: string,
      data: UpdateUnitKerjaDto,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: UnitKerjaItemDto;
        },
        void
      >({
        path: `/api/unit-kerja/${id}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Unit Kerja
     * @name UnitKerjaDeleteControllerRemove
     * @summary Nonaktifkan unit kerja (Superadmin)
     * @request DELETE:/api/unit-kerja/{id}
     * @secure
     */
    unitKerjaDeleteControllerRemove: (id: string, params: RequestParams = {}) =>
      this.request<void, void>({
        path: `/api/unit-kerja/${id}`,
        method: "DELETE",
        secure: true,
        ...params,
      }),
  };
  masterProyek = {
    /**
     * No description
     *
     * @tags Master - Proyek
     * @name ProyekGetDataControllerGetData
     * @summary Get daftar proyek (Superadmin, Koordinator, Subkoordinator, Keuangan (Legacy), Pimpinan)
     * @request GET:/api/proyek
     * @secure
     */
    proyekGetDataControllerGetData: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        /** @example 2026 */
        tahun_fiscal?: number;
        /** Filter proyek berdasarkan unit koordinator RO */
        id_unit_koordinator?: string;
        status_proyek?:
          | "MENUNGGU_VALIDASI_UMUM"
          | "MENUNGGU_NOTULEN"
          | "MENUNGGU_VALIDASI_PIMPINAN"
          | "DISETUJUI_PIMPINAN"
          | "SELESAI"
          | "DITOLAK_UMUM"
          | "DITOLAK_PIMPINAN";
      },
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: ProyekItemDto[];
          pagination?: {
            /** @example 10 */
            limit?: number;
            /** @example 1 */
            page?: number;
            /** @example 1 */
            total_pages?: number;
            /** @example 1 */
            total_datas?: number;
          };
        },
        void
      >({
        path: `/api/proyek`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Proyek
     * @name ProyekCreateControllerCreate
     * @summary Ajukan proyek (Superadmin, Koordinator)
     * @request POST:/api/proyek
     * @secure
     */
    proyekCreateControllerCreate: (
      data: CreateProyekDto,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponseCreate & {
          data?: ProyekItemDto;
        },
        void
      >({
        path: `/api/proyek`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Proyek
     * @name ProyekGetTerminQueueControllerGetTerminQueue
     * @summary Get antrean termin proyek untuk Billing dan Keuangan (Legacy) (Superadmin, Keuangan (Legacy), Keuangan - Billing)
     * @request GET:/api/proyek/termin-queue
     * @secure
     */
    proyekGetTerminQueueControllerGetTerminQueue: (
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/proyek/termin-queue`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Proyek
     * @name ProyekGetDetailControllerGetDetail
     * @summary Get detail proyek (Superadmin, Koordinator, Subkoordinator, Keuangan (Legacy), Pimpinan)
     * @request GET:/api/proyek/{id}
     * @secure
     */
    proyekGetDetailControllerGetDetail: (
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: ProyekItemDto;
        },
        void
      >({
        path: `/api/proyek/${id}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Proyek
     * @name ProyekUpdateControllerUpdate
     * @summary Update proyek (Superadmin)
     * @request PUT:/api/proyek/{id}
     * @secure
     */
    proyekUpdateControllerUpdate: (
      id: string,
      data: UpdateProyekDto,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: ProyekItemDto;
        },
        void
      >({
        path: `/api/proyek/${id}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Proyek
     * @name ProyekRemoveControllerRemove
     * @summary Hapus proyek (Superadmin)
     * @request DELETE:/api/proyek/{id}
     * @secure
     */
    proyekRemoveControllerRemove: (id: string, params: RequestParams = {}) =>
      this.request<void, void>({
        path: `/api/proyek/${id}`,
        method: "DELETE",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Proyek
     * @name ProyekGetTerminControllerGetTermin
     * @summary Get daftar termin proyek (Superadmin, Koordinator, Subkoordinator, Keuangan (Legacy), Pimpinan)
     * @request GET:/api/proyek/{id}/termin
     * @secure
     */
    proyekGetTerminControllerGetTermin: (
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<
        {
          /** @example 200 */
          status?: number;
          message?: string;
          data?: Record<string, any>[];
        },
        any
      >({
        path: `/api/proyek/${id}/termin`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Proyek
     * @name ProyekGetDistribusiControllerGetDistribusi
     * @summary Get distribusi margin proyek (Superadmin, Koordinator, Subkoordinator, Keuangan (Legacy), Pimpinan)
     * @request GET:/api/proyek/{id}/distribusi
     * @secure
     */
    proyekGetDistribusiControllerGetDistribusi: (
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/proyek/${id}/distribusi`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Proyek
     * @name ProyekUploadSkControllerUploadSk
     * @summary Upload SK proyek (Superadmin)
     * @request POST:/api/proyek/{id}/sk
     * @secure
     */
    proyekUploadSkControllerUploadSk: (
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/proyek/${id}/sk`,
        method: "POST",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Proyek
     * @name ProyekUploadRabControllerUploadRab
     * @summary Upload RAB proyek (Superadmin)
     * @request POST:/api/proyek/{id}/rab
     * @secure
     */
    proyekUploadRabControllerUploadRab: (
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/proyek/${id}/rab`,
        method: "POST",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Proyek
     * @name ProyekUploadNotulenControllerUploadNotulen
     * @summary Upload notulen proyek (Superadmin, Koordinator)
     * @request POST:/api/proyek/{id}/notulen
     * @secure
     */
    proyekUploadNotulenControllerUploadNotulen: (
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/proyek/${id}/notulen`,
        method: "POST",
        secure: true,
        ...params,
      }),

    /**
     * @tags Master - Proyek
     * @name ProyekUploadBastControllerUploadBast
     * @summary Upload BAST dan selesaikan proyek (Superadmin, Koordinator pemilik)
     * @request POST:/api/proyek/{id}/bast
     * @secure
     */
    proyekUploadBastControllerUploadBast: (
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/proyek/${id}/bast`,
        method: "POST",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Proyek
     * @name ProyekValidasiUmumControllerValidasiUmum
     * @summary Validasi Bagian Umum proyek (Superadmin, Koordinator)
     * @request POST:/api/proyek/{id}/validasi-umum
     * @secure
     */
    proyekValidasiUmumControllerValidasiUmum: (
      id: string,
      data: ProyekValidationDto,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: ProyekItemDto;
        },
        void
      >({
        path: `/api/proyek/${id}/validasi-umum`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Proyek
     * @name ProyekValidasiPimpinanControllerValidasiPimpinan
     * @summary Validasi Pimpinan proyek (Superadmin, Pimpinan)
     * @request POST:/api/proyek/{id}/validasi-pimpinan
     * @secure
     */
    proyekValidasiPimpinanControllerValidasiPimpinan: (
      id: string,
      data: ProyekValidationDto,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: ProyekItemDto;
        },
        void
      >({
        path: `/api/proyek/${id}/validasi-pimpinan`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  masterRo = {
    /**
     * No description
     *
     * @tags Master - RO
     * @name RoGetDataControllerGetData
     * @summary Get daftar RO (Superadmin, Koordinator, Subkoordinator, Keuangan (Legacy), Pimpinan)
     * @request GET:/api/ro
     * @secure
     */
    roGetDataControllerGetData: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        /** Filter proyek */
        id_proyek?: string;
        /** Filter unit koordinator */
        id_unit_koordinator?: string;
        /** @example 2026 */
        tahun_fiscal?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: RoItemDto[];
          pagination?: {
            /** @example 10 */
            limit?: number;
            /** @example 1 */
            page?: number;
            /** @example 1 */
            total_pages?: number;
            /** @example 1 */
            total_datas?: number;
          };
        },
        void
      >({
        path: `/api/ro`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - RO
     * @name RoCreateControllerCreate
     * @summary Tambah RO (Superadmin)
     * @request POST:/api/ro
     * @secure
     */
    roCreateControllerCreate: (data: CreateRoDto, params: RequestParams = {}) =>
      this.request<
        StandartResponseCreate & {
          data?: RoItemDto;
        },
        void
      >({
        path: `/api/ro`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - RO
     * @name RoGetDetailControllerGetDetail
     * @summary Get detail RO (Superadmin, Koordinator, Subkoordinator, Keuangan (Legacy), Pimpinan)
     * @request GET:/api/ro/{id}
     * @secure
     */
    roGetDetailControllerGetDetail: (id: string, params: RequestParams = {}) =>
      this.request<
        StandartResponse & {
          data?: RoDetailDto;
        },
        void
      >({
        path: `/api/ro/${id}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - RO
     * @name RoUpdateControllerUpdate
     * @summary Update RO (Superadmin, Koordinator)
     * @request PUT:/api/ro/{id}
     * @secure
     */
    roUpdateControllerUpdate: (
      id: string,
      data: UpdateRoDto,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: RoItemDto;
        },
        void
      >({
        path: `/api/ro/${id}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - RO
     * @name RoRemoveControllerRemove
     * @summary Hapus RO (Superadmin)
     * @request DELETE:/api/ro/{id}
     * @secure
     */
    roRemoveControllerRemove: (id: string, params: RequestParams = {}) =>
      this.request<void, void>({
        path: `/api/ro/${id}`,
        method: "DELETE",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - RO
     * @name RoCarryoverSilpaControllerCarryoverSilpa
     * @summary Bawa saldo RO ke tahun fiskal berikutnya sebagai SILPA proyek (Superadmin)
     * @request POST:/api/ro/{id}/silpa
     * @secure
     */
    roCarryoverSilpaControllerCarryoverSilpa: (
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/ro/${id}/silpa`,
        method: "POST",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - RO
     * @name RoGetLedgerControllerGetLedger
     * @summary Get ledger RO (Superadmin, Koordinator, Subkoordinator, Keuangan (Legacy))
     * @request GET:/api/ro/{id}/ledger
     * @secure
     */
    roGetLedgerControllerGetLedger: (id: string, params: RequestParams = {}) =>
      this.request<
        StandartResponse & {
          data?: object;
        },
        void
      >({
        path: `/api/ro/${id}/ledger`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - RO
     * @name RoUploadRabControllerUploadRab
     * @summary Upload RAB RO (Superadmin, Koordinator)
     * @request POST:/api/ro/{id}/rab
     * @secure
     */
    roUploadRabControllerUploadRab: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/ro/${id}/rab`,
        method: "POST",
        secure: true,
        ...params,
      }),
  };
  masterRoTransaksi = {
    /**
     * No description
     *
     * @tags Master - RO Transaksi
     * @name RoTransaksiListControllerList
     * @summary List transaksi RO (Superadmin, Koordinator, Keuangan (Legacy))
     * @request GET:/api/ro/{id}/transaksi
     * @secure
     */
    roTransaksiListControllerList: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/ro/${id}/transaksi`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - RO Transaksi
     * @name RoTransaksiCreateControllerCreate
     * @summary Tambah transaksi RO (Superadmin, Keuangan - Bendahara)
     * @request POST:/api/ro/{id}/transaksi
     * @secure
     */
    roTransaksiCreateControllerCreate: (
      id: string,
      data: CreateRoTransaksiDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/ro/${id}/transaksi`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - RO Transaksi
     * @name RoTransaksiUpdateControllerUpdate
     * @summary Update transaksi RO (Superadmin, Keuangan - Bendahara)
     * @request PUT:/api/ro/{id}/transaksi/{tid}
     * @secure
     */
    roTransaksiUpdateControllerUpdate: (
      id: string,
      tid: string,
      data: UpdateRoTransaksiDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/ro/${id}/transaksi/${tid}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - RO Transaksi
     * @name RoTransaksiRemoveControllerRemove
     * @summary Hapus transaksi RO (Superadmin, Keuangan - Bendahara)
     * @request DELETE:/api/ro/{id}/transaksi/{tid}
     * @secure
     */
    roTransaksiRemoveControllerRemove: (
      id: string,
      tid: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/ro/${id}/transaksi/${tid}`,
        method: "DELETE",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - RO Transaksi
     * @name RoTransaksiUploadDocumentControllerUploadDocument
     * @summary Unggah bukti transaksi RO (Superadmin, Koordinator)
     * @request POST:/api/ro/{id}/transaksi/{tid}/dokumen
     * @secure
     */
    roTransaksiUploadDocumentControllerUploadDocument: (
      id: string,
      tid: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/ro/${id}/transaksi/${tid}/dokumen`,
        method: "POST",
        secure: true,
        ...params,
      }),
  };
  masterDanaOperasional = {
    /**
     * No description
     *
     * @tags Master - Dana Operasional
     * @name DanaOperasionalGetDataControllerGetData
     * @summary Get daftar dana operasional (Superadmin, Koordinator, Keuangan (Legacy), Keuangan - Bendahara, Keuangan - KARWAS)
     * @request GET:/api/dana-operasional
     * @secure
     */
    danaOperasionalGetDataControllerGetData: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        /** Filter unit koordinator */
        id_unit_koordinator?: string;
        /** @example 2026 */
        tahun_fiscal?: number;
        /** Filter kategori kamar */
        kategori_kamar?:
          | "P1_PNS_NON_PNS"
          | "P2_KP3"
          | "OPS_KANTOR"
          | "OPS_KP3"
          | "MULOS_SPI"
          | "LAINNYA";
      },
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: DanaOperasionalItemDto[];
          pagination?: {
            /** @example 10 */
            limit?: number;
            /** @example 1 */
            page?: number;
            /** @example 1 */
            total_pages?: number;
            /** @example 1 */
            total_datas?: number;
          };
        },
        void
      >({
        path: `/api/dana-operasional`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Dana Operasional
     * @name DanaOperasionalCreateControllerCreate
     * @summary Tambah dana operasional (Superadmin)
     * @request POST:/api/dana-operasional
     * @secure
     */
    danaOperasionalCreateControllerCreate: (
      data: CreateDanaOperasionalDto,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponseCreate & {
          data?: DanaOperasionalItemDto;
        },
        void
      >({
        path: `/api/dana-operasional`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Dana Operasional
     * @name DanaOperasionalGetDetailControllerGetDetail
     * @summary Get detail dana operasional (Superadmin, Koordinator, Keuangan (Legacy), Keuangan - Bendahara, Keuangan - KARWAS, Pimpinan)
     * @request GET:/api/dana-operasional/{id}
     * @secure
     */
    danaOperasionalGetDetailControllerGetDetail: (
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: DanaOperasionalItemDto;
        },
        void
      >({
        path: `/api/dana-operasional/${id}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Dana Operasional
     * @name DanaOperasionalUpdateControllerUpdate
     * @summary Update dana operasional (Superadmin)
     * @request PUT:/api/dana-operasional/{id}
     * @secure
     */
    danaOperasionalUpdateControllerUpdate: (
      id: string,
      data: UpdateDanaOperasionalDto,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: DanaOperasionalItemDto;
        },
        void
      >({
        path: `/api/dana-operasional/${id}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Dana Operasional
     * @name DanaOperasionalRemoveControllerRemove
     * @summary Hapus dana operasional (Superadmin)
     * @request DELETE:/api/dana-operasional/{id}
     * @secure
     */
    danaOperasionalRemoveControllerRemove: (
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<void, void>({
        path: `/api/dana-operasional/${id}`,
        method: "DELETE",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Dana Operasional
     * @name DanaOperasionalGetLedgerControllerGetLedger
     * @summary Get ledger Dana Operasional (Superadmin, Koordinator, Keuangan (Legacy), Keuangan - Bendahara, Keuangan - KARWAS)
     * @request GET:/api/dana-operasional/{id}/ledger
     * @secure
     */
    danaOperasionalGetLedgerControllerGetLedger: (
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: object;
        },
        void
      >({
        path: `/api/dana-operasional/${id}/ledger`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),
  };
  masterDanaTransaksi = {
    /**
     * No description
     *
     * @tags Master - Dana Transaksi
     * @name DanaTransaksiListControllerList
     * @summary List transaksi dana (Superadmin, Koordinator, Keuangan (Legacy), Keuangan - KARWAS)
     * @request GET:/api/dana-operasional/{id}/transaksi
     * @secure
     */
    danaTransaksiListControllerList: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/dana-operasional/${id}/transaksi`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Dana Transaksi
     * @name DanaTransaksiCreateControllerCreate
     * @summary Tambah transaksi dana (Superadmin, Koordinator, Keuangan (Legacy))
     * @request POST:/api/dana-operasional/{id}/transaksi
     * @secure
     */
    danaTransaksiCreateControllerCreate: (
      id: string,
      data: CreateDanaTransaksiDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/dana-operasional/${id}/transaksi`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Dana Transaksi
     * @name DanaTransaksiUpdateControllerUpdate
     * @summary Update transaksi dana (Superadmin, Koordinator, Keuangan (Legacy))
     * @request PUT:/api/dana-operasional/{id}/transaksi/{tid}
     * @secure
     */
    danaTransaksiUpdateControllerUpdate: (
      tid: string,
      id: string,
      data: UpdateDanaTransaksiDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/dana-operasional/${id}/transaksi/${tid}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Dana Transaksi
     * @name DanaTransaksiRemoveControllerRemove
     * @summary Hapus transaksi dana (Superadmin, Koordinator, Keuangan (Legacy))
     * @request DELETE:/api/dana-operasional/{id}/transaksi/{tid}
     * @secure
     */
    danaTransaksiRemoveControllerRemove: (
      tid: string,
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/dana-operasional/${id}/transaksi/${tid}`,
        method: "DELETE",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Dana Transaksi
     * @name DanaTransaksiUploadDocumentControllerUploadDocument
     * @summary Unggah bukti transaksi dana (Superadmin, Koordinator, Keuangan (Legacy))
     * @request POST:/api/dana-operasional/{id}/transaksi/{tid}/dokumen
     * @secure
     */
    danaTransaksiUploadDocumentControllerUploadDocument: (
      id: string,
      tid: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/dana-operasional/${id}/transaksi/${tid}/dokumen`,
        method: "POST",
        secure: true,
        ...params,
      }),
  };
  sk = {
    /**
     * No description
     *
     * @tags SK
     * @name SkGetGetDataControllerGetData
     * @summary Get daftar SK (Superadmin, Koordinator, Keuangan (Legacy))
     * @request GET:/api/sk
     * @secure
     */
    skGetGetDataControllerGetData: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        /** Filter pegawai */
        id_pegawai?: string;
        /** Filter unit kerja */
        id_unit_kerja?: string;
        /** Hanya SK aktif */
        status_aktif?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: SkItemDto[];
          pagination?: {
            /** @example 10 */
            limit?: number;
            /** @example 1 */
            page?: number;
            /** @example 1 */
            total_pages?: number;
            /** @example 1 */
            total_datas?: number;
          };
        },
        void
      >({
        path: `/api/sk`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags SK
     * @name SkPostControllerCreate
     * @summary Tambah SK (Superadmin)
     * @request POST:/api/sk
     * @secure
     */
    skPostControllerCreate: (data: CreateSkDto, params: RequestParams = {}) =>
      this.request<
        StandartResponseCreate & {
          data?: SkItemDto;
        },
        void
      >({
        path: `/api/sk`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.FormData,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags SK
     * @name SkGetGetExpiringSoonControllerGetExpiringSoon
     * @summary SK hampir habis (30 hari) (Superadmin, Koordinator, Keuangan (Legacy))
     * @request GET:/api/sk/expiring-soon
     * @secure
     */
    skGetGetExpiringSoonControllerGetExpiringSoon: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        /** Filter pegawai */
        id_pegawai?: string;
        /** Filter unit kerja */
        id_unit_kerja?: string;
        /** Hanya SK aktif */
        status_aktif?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: SkItemDto[];
          pagination?: {
            /** @example 10 */
            limit?: number;
            /** @example 1 */
            page?: number;
            /** @example 1 */
            total_pages?: number;
            /** @example 1 */
            total_datas?: number;
          };
        },
        void
      >({
        path: `/api/sk/expiring-soon`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags SK
     * @name SkGetGetRiwayatControllerGetRiwayat
     * @summary Get riwayat SK pegawai (Superadmin, Koordinator, Keuangan (Legacy))
     * @request GET:/api/sk/pegawai/{pegawaiId}
     * @secure
     */
    skGetGetRiwayatControllerGetRiwayat: (
      pegawaiId: string,
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        /** Filter pegawai */
        id_pegawai?: string;
        /** Filter unit kerja */
        id_unit_kerja?: string;
        /** Hanya SK aktif */
        status_aktif?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: SkItemDto[];
          pagination?: {
            /** @example 10 */
            limit?: number;
            /** @example 1 */
            page?: number;
            /** @example 1 */
            total_pages?: number;
            /** @example 1 */
            total_datas?: number;
          };
        },
        void
      >({
        path: `/api/sk/pegawai/${pegawaiId}`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags SK
     * @name SkPutUpdateControllerUpdate
     * @summary Update SK (Superadmin)
     * @request PUT:/api/sk/{id}
     * @secure
     */
    skPutUpdateControllerUpdate: (
      id: string,
      data: UpdateSkDto,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: SkItemDto;
        },
        void
      >({
        path: `/api/sk/${id}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.FormData,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags SK
     * @name SkDeleteControllerRemove
     * @summary Hapus SK (Superadmin)
     * @request DELETE:/api/sk/{id}
     * @secure
     */
    skDeleteControllerRemove: (id: string, params: RequestParams = {}) =>
      this.request<void, void>({
        path: `/api/sk/${id}`,
        method: "DELETE",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags SK
     * @name SkPutActivateControllerActivate
     * @summary Aktifkan/nonaktifkan SK (Superadmin)
     * @request PUT:/api/sk/{id}/activate
     * @secure
     */
    skPutActivateControllerActivate: (
      id: string,
      data: ActivateSkDto,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: SkItemDto;
        },
        void
      >({
        path: `/api/sk/${id}/activate`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  alokasiGajiTa = {
    /**
     * No description
     *
     * @tags Alokasi Gaji TA
     * @name AlokasiGetControllerGetData
     * @summary Get daftar alokasi gaji TA (Superadmin, Koordinator, Keuangan (Legacy))
     * @request GET:/api/alokasi-gaji
     * @secure
     */
    alokasiGetControllerGetData: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        /** Filter pegawai */
        id_pegawai?: string;
        /** Filter unit kerja (termasuk anak unit) */
        id_unit_kerja?: string;
        /**
         * @min 1
         * @max 12
         * @example 1
         */
        periode_bulan?: number;
        /** @example 2026 */
        periode_tahun?: number;
        sumber_dana?: "RO" | "OPERASIONAL";
      },
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: AlokasiItemDto[];
          pagination?: {
            /** @example 10 */
            limit?: number;
            /** @example 1 */
            page?: number;
            /** @example 1 */
            total_pages?: number;
            /** @example 1 */
            total_datas?: number;
          };
        },
        void
      >({
        path: `/api/alokasi-gaji`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Alokasi Gaji TA
     * @name AlokasiPostControllerCreate
     * @summary Buat alokasi gaji TA (Superadmin, Koordinator, Keuangan (Legacy))
     * @request POST:/api/alokasi-gaji
     * @secure
     */
    alokasiPostControllerCreate: (
      data: CreateAlokasiDto,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponseCreate & {
          data?: AlokasiItemDto;
        },
        void
      >({
        path: `/api/alokasi-gaji`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Alokasi Gaji TA
     * @name AlokasiPutControllerUpdate
     * @summary Update alokasi gaji TA (Superadmin, Koordinator, Keuangan (Legacy))
     * @request PUT:/api/alokasi-gaji/{id}
     * @secure
     */
    alokasiPutControllerUpdate: (
      id: string,
      data: UpdateAlokasiDto,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: AlokasiItemDto;
        },
        void
      >({
        path: `/api/alokasi-gaji/${id}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Alokasi Gaji TA
     * @name AlokasiDeleteControllerCancel
     * @summary Batalkan alokasi gaji TA (Superadmin, Koordinator, Keuangan (Legacy))
     * @request DELETE:/api/alokasi-gaji/{id}
     * @secure
     */
    alokasiDeleteControllerCancel: (id: string, params: RequestParams = {}) =>
      this.request<
        StandartResponse & {
          data?: AlokasiItemDto;
        },
        void
      >({
        path: `/api/alokasi-gaji/${id}`,
        method: "DELETE",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Alokasi Gaji TA
     * @name AlokasiRekapGetRekapControllerGetRekap
     * @summary Rekap alokasi gaji TA bulanan (Superadmin, Koordinator, Keuangan (Legacy))
     * @request GET:/api/alokasi-gaji/rekap
     * @secure
     */
    alokasiRekapGetRekapControllerGetRekap: (
      query?: {
        /**
         * @min 1
         * @max 12
         * @example 1
         */
        periode_bulan?: number;
        /** @example 2026 */
        periode_tahun?: number;
        /** Filter unit (termasuk anak unit) */
        id_unit_kerja?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: RekapItemDto[];
        },
        void
      >({
        path: `/api/alokasi-gaji/rekap`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Alokasi Gaji TA
     * @name AlokasiRekapExportRekapControllerExportRekap
     * @summary Export rekap alokasi gaji TA ke Excel (Superadmin, Koordinator, Keuangan (Legacy))
     * @request GET:/api/alokasi-gaji/rekap/export
     * @secure
     */
    alokasiRekapExportRekapControllerExportRekap: (
      query?: {
        /**
         * @min 1
         * @max 12
         * @example 1
         */
        periode_bulan?: number;
        /** @example 2026 */
        periode_tahun?: number;
        /** Filter unit (termasuk anak unit) */
        id_unit_kerja?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/alokasi-gaji/rekap/export`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),
  };
  dashboard = {
    /**
     * No description
     *
     * @tags Dashboard
     * @name DashboardGetSuperadminDashboardControllerGetSuperadminDashboard
     * @summary Dashboard keuangan (Superadmin, Keuangan (Legacy), Keuangan - Billing, Keuangan - Bendahara, Keuangan - KARWAS)
     * @request GET:/api/dashboard/superadmin
     * @secure
     */
    dashboardGetSuperadminDashboardControllerGetSuperadminDashboard: (
      query?: {
        /** @example 2026 */
        tahun?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/dashboard/superadmin`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Dashboard
     * @name DashboardGetMonevControllerGetMonev
     * @summary Monev keuangan KARWAS (Superadmin, Keuangan - KARWAS)
     * @request GET:/api/dashboard/monev
     * @secure
     */
    dashboardGetMonevControllerGetMonev: (
      query?: {
        /** @example 2026 */
        tahun?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/dashboard/monev`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Dashboard
     * @name DashboardGetKoordinatorUnitDashboardControllerGetKoordinatorUnitDashboard
     * @summary Dashboard koordinator untuk unit miliknya (Superadmin, Koordinator)
     * @request GET:/api/dashboard/koordinator-unit
     * @secure
     */
    dashboardGetKoordinatorUnitDashboardControllerGetKoordinatorUnitDashboard: (
      query?: {
        /** @example 2026 */
        tahun?: number;
        /** UUID unit koordinator (wajib untuk Superadmin) */
        id_unit_koordinator?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/dashboard/koordinator-unit`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Dashboard
     * @name DashboardGetSkExpiringSoonControllerGetSkExpiringSoon
     * @summary SK yang masa berlakunya hampir habis (30 hari) (Superadmin, Keuangan (Legacy))
     * @request GET:/api/dashboard/sk-expiring-soon
     * @secure
     */
    dashboardGetSkExpiringSoonControllerGetSkExpiringSoon: (
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/dashboard/sk-expiring-soon`,
        method: "GET",
        secure: true,
        ...params,
      }),
  };
  users = {
    /**
     * No description
     *
     * @tags Users
     * @name UsersGetControllerGetData
     * @summary Get daftar user (Superadmin)
     * @request GET:/api/users
     * @secure
     */
    usersGetControllerGetData: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        role?:
          | "SUPERADMIN"
          | "KOORDINATOR"
          | "SUBKOOR"
          | "KARYAWAN"
          | "KEUANGAN"
          | "KEU_BILLING"
          | "KEU_BENDAHARA"
          | "KEU_KARWAS"
          | "PIMPINAN"
          | "SPI";
        status?: "AKTIF" | "NONAKTIF";
      },
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: UserItemDto[];
          pagination?: {
            /** @example 10 */
            limit?: number;
            /** @example 1 */
            page?: number;
            /** @example 1 */
            total_pages?: number;
            /** @example 1 */
            total_datas?: number;
          };
        },
        void
      >({
        path: `/api/users`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Users
     * @name UsersPostControllerCreate
     * @summary Buat user baru (Superadmin)
     * @request POST:/api/users
     * @secure
     */
    usersPostControllerCreate: (
      data: CreateUserDto,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponseCreate & {
          data?: UserItemDto;
        },
        void
      >({
        path: `/api/users`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags Users
     * @name UsersPutControllerUpdate
     * @summary Update user (Superadmin)
     * @request PUT:/api/users/{id}
     * @secure
     */
    usersPutControllerUpdate: (
      id: string,
      data: UpdateUserDto,
      params: RequestParams = {},
    ) =>
      this.request<
        StandartResponse & {
          data?: UserItemDto;
        },
        void
      >({
        path: `/api/users/${id}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  myProfile = {
    /**
     * No description
     *
     * @tags My Profile
     * @name MyProfileGetProfileControllerGetProfile
     * @summary Profil saya (Superadmin, Koordinator, Subkoordinator, Keuangan (Legacy), Keuangan - Billing, Keuangan - Bendahara, Keuangan - KARWAS, Pimpinan, Satuan Pengawasan Intern (SPI), Karyawan)
     * @request GET:/api/my/profile
     * @secure
     */
    myProfileGetProfileControllerGetProfile: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/my/profile`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags My Profile
     * @name MyProfileGetMySkControllerGetMySk
     * @summary Riwayat SK saya (Superadmin, Koordinator, Subkoordinator, Keuangan (Legacy), Keuangan - Billing, Keuangan - Bendahara, Keuangan - KARWAS, Pimpinan, Satuan Pengawasan Intern (SPI), Karyawan)
     * @request GET:/api/my/sk
     * @secure
     */
    myProfileGetMySkControllerGetMySk: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/my/sk`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags My Profile
     * @name MyProfileGetMyAlokasiControllerGetMyAlokasi
     * @summary Riwayat alokasi gaji saya (Superadmin, Koordinator, Subkoordinator, Keuangan (Legacy), Keuangan - Billing, Keuangan - Bendahara, Keuangan - KARWAS, Pimpinan, Satuan Pengawasan Intern (SPI), Karyawan)
     * @request GET:/api/my/alokasi
     * @secure
     */
    myProfileGetMyAlokasiControllerGetMyAlokasi: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/my/alokasi`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),
  };
  file = {
    /**
     * No description
     *
     * @tags File
     * @name FileControllerGetFile
     * @request GET:/api/uploaded/{path}
     */
    fileControllerGetFile: (path: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/uploaded/${path}`,
        method: "GET",
        ...params,
      }),
  };
  finance = {
    /**
     * No description
     *
     * @tags Finance
     * @name FinanceDistributeControllerDistribute
     * @summary Distribusi margin otomatis (Superadmin)
     * @request POST:/api/finance/distribute-margin
     * @secure
     */
    financeDistributeControllerDistribute: (
      data: DistributeMarginDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/finance/distribute-margin`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Finance
     * @name FinanceDistribusiMarginControllerDistribusiMargin
     * @summary Distribusi margin testing (Superadmin)
     * @request POST:/api/finance/distribusi-margin
     * @secure
     */
    financeDistribusiMarginControllerDistribusiMargin: (
      data: DistribusiMarginSimpleDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/finance/distribusi-margin`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),
  };
  sumberDana = {
    /**
     * No description
     *
     * @tags Sumber Dana
     * @name SumberDanaControllerGetAvailable
     * @summary Get available funding sources scoped by unit (Superadmin, Koordinator, Keuangan (Legacy))
     * @request GET:/api/sumber-dana/available
     * @secure
     */
    sumberDanaControllerGetAvailable: (
      query?: {
        /** Filter by unit_kerja_id (koordinator scope) */
        unit_kerja_id?: string;
        /** @example 2026 */
        tahun_fiscal?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/sumber-dana/available`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),
  };
  masterPengaturanMargin = {
    /**
     * No description
     *
     * @tags Master - Pengaturan Margin
     * @name PengaturanMarginGetDataControllerGetData
     * @summary Get daftar pengaturan margin (Superadmin, Koordinator, Keuangan (Legacy), Pimpinan)
     * @request GET:/api/pengaturan-margin
     * @secure
     */
    pengaturanMarginGetDataControllerGetData: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengaturan-margin`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Pengaturan Margin
     * @name PengaturanMarginUpdateControllerUpdate
     * @summary Update pengaturan margin (Superadmin)
     * @request PUT:/api/pengaturan-margin/{id}
     * @secure
     */
    pengaturanMarginUpdateControllerUpdate: (
      id: string,
      data: UpdatePengaturanMarginDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/pengaturan-margin/${id}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),
  };
  masterRekeningBank = {
    /**
     * No description
     *
     * @tags Master - Rekening Bank
     * @name MasterRekeningFindAllControllerFindAll
     * @summary Get daftar rekening bank (Superadmin, Keuangan (Legacy), Keuangan - Bendahara)
     * @request GET:/api/master-rekening
     * @secure
     */
    masterRekeningFindAllControllerFindAll: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/master-rekening`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Rekening Bank
     * @name MasterRekeningCreateControllerCreate
     * @summary Buat rekening bank (Superadmin, Keuangan (Legacy))
     * @request POST:/api/master-rekening
     * @secure
     */
    masterRekeningCreateControllerCreate: (
      data: CreateMasterRekeningDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/master-rekening`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Rekening Bank
     * @name MasterRekeningFindOneControllerFindOne
     * @summary Get detail rekening bank (Superadmin, Keuangan (Legacy), Keuangan - Bendahara)
     * @request GET:/api/master-rekening/{id}
     * @secure
     */
    masterRekeningFindOneControllerFindOne: (
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/master-rekening/${id}`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Rekening Bank
     * @name MasterRekeningUpdateControllerUpdate
     * @summary Ubah rekening bank (Superadmin, Keuangan (Legacy))
     * @request PUT:/api/master-rekening/{id}
     * @secure
     */
    masterRekeningUpdateControllerUpdate: (
      id: string,
      data: UpdateMasterRekeningDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/master-rekening/${id}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - Rekening Bank
     * @name MasterRekeningRemoveControllerRemove
     * @summary Hapus rekening bank (Superadmin)
     * @request DELETE:/api/master-rekening/{id}
     * @secure
     */
    masterRekeningRemoveControllerRemove: (
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/master-rekening/${id}`,
        method: "DELETE",
        secure: true,
        ...params,
      }),
  };
  rekonsiliasiBank = {
    /**
     * No description
     *
     * @tags Rekonsiliasi Bank
     * @name RekonsiliasiBankGetSaldoSistemControllerGetSaldoSistem
     * @summary Hitung saldo kas virtual sistem (Superadmin, Keuangan (Legacy))
     * @request GET:/api/rekonsiliasi/saldo-sistem
     * @secure
     */
    rekonsiliasiBankGetSaldoSistemControllerGetSaldoSistem: (
      query?: {
        /** @example "uuid-rekening" */
        rekening_id?: string;
        /** @example 2026 */
        tahun_fiscal?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/rekonsiliasi/saldo-sistem`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Rekonsiliasi Bank
     * @name RekonsiliasiBankFindAllControllerFindAll
     * @summary Get riwayat rekonsiliasi bank (Superadmin, Keuangan (Legacy))
     * @request GET:/api/rekonsiliasi
     * @secure
     */
    rekonsiliasiBankFindAllControllerFindAll: (
      query?: {
        /** @example "uuid-rekening" */
        rekening_id?: string;
        /** @example 2026 */
        tahun_fiscal?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/rekonsiliasi`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Rekonsiliasi Bank
     * @name RekonsiliasiBankCreateControllerCreate
     * @summary Buat rekonsiliasi bank (Superadmin, Keuangan (Legacy))
     * @request POST:/api/rekonsiliasi
     * @secure
     */
    rekonsiliasiBankCreateControllerCreate: (
      data: CreateRekonsiliasiBankDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/rekonsiliasi`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),
  };
  masterMak = {
    /**
     * No description
     *
     * @tags Master - MAK
     * @name MasterMakFindAllControllerFindAll
     * @summary Get daftar MAK (Superadmin, Keuangan (Legacy), Koordinator)
     * @request GET:/api/master-mak
     * @secure
     */
    masterMakFindAllControllerFindAll: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/master-mak`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - MAK
     * @name MasterMakCreateControllerCreate
     * @summary Buat MAK (Superadmin, Keuangan (Legacy))
     * @request POST:/api/master-mak
     * @secure
     */
    masterMakCreateControllerCreate: (
      data: CreateMasterMakDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/master-mak`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - MAK
     * @name MasterMakFindOneControllerFindOne
     * @summary Get detail MAK (Superadmin, Keuangan (Legacy))
     * @request GET:/api/master-mak/{id}
     * @secure
     */
    masterMakFindOneControllerFindOne: (
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/master-mak/${id}`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - MAK
     * @name MasterMakUpdateControllerUpdate
     * @summary Ubah MAK (Superadmin, Keuangan (Legacy))
     * @request PUT:/api/master-mak/{id}
     * @secure
     */
    masterMakUpdateControllerUpdate: (
      id: string,
      data: UpdateMasterMakDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/master-mak/${id}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Master - MAK
     * @name MasterMakRemoveControllerRemove
     * @summary Hapus MAK (Superadmin)
     * @request DELETE:/api/master-mak/{id}
     * @secure
     */
    masterMakRemoveControllerRemove: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/master-mak/${id}`,
        method: "DELETE",
        secure: true,
        ...params,
      }),
  };
  keuanganPengajuanBelanja = {
    /**
     * No description
     *
     * @tags Keuangan - Pengajuan Belanja
     * @name PengajuanBelanjaListControllerList
     * @summary Daftar pengajuan belanja (Superadmin, Koordinator, Subkoordinator, Keuangan (Legacy), Keuangan - KARWAS, Keuangan - Bendahara, Pimpinan, Satuan Pengawasan Intern (SPI))
     * @request GET:/api/pengajuan-belanja
     * @secure
     */
    pengajuanBelanjaListControllerList: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        jenis_sumber?: "PROYEK" | "LAYANAN_RETAIL";
        ro_id?: string;
        status?: string;
        id_proyek?: string;
        id_unit_koordinator?: string;
        unit_pelaksana_id?: string;
        /** @example 2026 */
        tahun_fiscal?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/pengajuan-belanja`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Keuangan - Pengajuan Belanja
     * @name PengajuanBelanjaCreateControllerCreate
     * @summary Ajukan belanja (Superadmin, Koordinator, Subkoordinator)
     * @request POST:/api/pengajuan-belanja
     * @secure
     */
    pengajuanBelanjaCreateControllerCreate: (
      data: CreatePengajuanBelanjaDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/pengajuan-belanja`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Keuangan - Pengajuan Belanja
     * @name PengajuanBelanjaFilterOptionsControllerFilterOptions
     * @summary Opsi filter pengajuan belanja (Superadmin, Koordinator, Subkoordinator, Keuangan (Legacy), Keuangan - KARWAS, Keuangan - Bendahara, Pimpinan, Satuan Pengawasan Intern (SPI))
     * @request GET:/api/pengajuan-belanja/filter-options
     * @secure
     */
    pengajuanBelanjaFilterOptionsControllerFilterOptions: (
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/pengajuan-belanja/filter-options`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Keuangan - Pengajuan Belanja
     * @name PengajuanBelanjaReviewContextControllerReviewContext
     * @summary Konteks finansial untuk review KARWAS (Superadmin, Keuangan - KARWAS)
     * @request GET:/api/pengajuan-belanja/{id}/review-context
     * @secure
     */
    pengajuanBelanjaReviewContextControllerReviewContext: (
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/pengajuan-belanja/${id}/review-context`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Keuangan - Pengajuan Belanja
     * @name PengajuanBelanjaReviewControllerReview
     * @summary Review KARWAS (Superadmin, Keuangan - KARWAS)
     * @request POST:/api/pengajuan-belanja/{id}/review
     * @secure
     */
    pengajuanBelanjaReviewControllerReview: (
      id: string,
      data: ReviewPengajuanBelanjaDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/pengajuan-belanja/${id}/review`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Keuangan - Pengajuan Belanja
     * @name PengajuanBelanjaBayarControllerBayar
     * @summary Bayar pengajuan belanja (Superadmin, Keuangan - Bendahara)
     * @request POST:/api/pengajuan-belanja/{id}/bayar
     * @secure
     */
    pengajuanBelanjaBayarControllerBayar: (
      id: string,
      data: BayarPengajuanBelanjaDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/pengajuan-belanja/${id}/bayar`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),
  };
  keuanganInvoiceDanSettlement = {
    /**
     * No description
     *
     * @tags Keuangan - Invoice dan Settlement
     * @name InvoiceListControllerList
     * @summary Daftar invoice (Superadmin, Keuangan (Legacy), Keuangan - Billing, Keuangan - Bendahara, Pimpinan, Satuan Pengawasan Intern (SPI))
     * @request GET:/api/keuangan/invoice
     * @secure
     */
    invoiceListControllerList: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        status?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/keuangan/invoice`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Keuangan - Invoice dan Settlement
     * @name InvoiceCreateInvoiceControllerCreateInvoice
     * @summary Terbitkan invoice (Superadmin, Keuangan (Legacy), Keuangan - Billing)
     * @request POST:/api/keuangan/invoice
     * @secure
     */
    invoiceCreateInvoiceControllerCreateInvoice: (
      data: CreateInvoiceDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/keuangan/invoice`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Keuangan - Invoice dan Settlement
     * @name InvoiceCreateMutasiControllerCreateMutasi
     * @summary Catat mutasi bank (Superadmin, Keuangan (Legacy), Keuangan - Bendahara)
     * @request POST:/api/keuangan/mutasi-bank
     * @secure
     */
    invoiceCreateMutasiControllerCreateMutasi: (
      data: {
        /** @format uuid */
        rekening_id: string;
        /** @format date */
        tanggal_transaksi: string;
        nominal: number;
        referensi_bank: string;
        nama_pengirim?: string;
        keterangan?: string;
        /** @format binary */
        file: File;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/keuangan/mutasi-bank`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.FormData,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Keuangan - Invoice dan Settlement
     * @name InvoiceBayarControllerBayar
     * @summary Validasi pembayaran invoice (Superadmin, Keuangan (Legacy), Keuangan - Bendahara)
     * @request POST:/api/keuangan/invoice/{id}/bayar
     * @secure
     */
    invoiceBayarControllerBayar: (
      id: string,
      data: BayarInvoiceDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/keuangan/invoice/${id}/bayar`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),
  };
  layananRetailNonRo = {
    /**
     * No description
     *
     * @tags Layanan Retail Non-RO
     * @name RetailUnitsControllerUnits
     * @summary Daftar unit pelaksana retail (Superadmin, Koordinator, Subkoordinator, Superadmin, Keuangan (Legacy), Keuangan - Billing, Keuangan - Bendahara, Keuangan - KARWAS)
     * @request GET:/api/retail/units
     * @secure
     */
    retailUnitsControllerUnits: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/retail/units`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Layanan Retail Non-RO
     * @name RetailListJobsControllerListJobs
     * @summary Daftar job layanan retail (Superadmin, Koordinator, Subkoordinator, Superadmin, Keuangan (Legacy), Keuangan - Billing, Keuangan - Bendahara, Keuangan - KARWAS)
     * @request GET:/api/retail/jobs
     * @secure
     */
    retailListJobsControllerListJobs: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        status?: string;
        status_invoice?: "DRAFT" | "DITERBITKAN" | "LUNAS" | "DIBATALKAN";
        unit_pelaksana_id?: string;
        /** @example 2026 */
        tahun_fiscal?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/retail/jobs`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Layanan Retail Non-RO
     * @name RetailCreateJobControllerCreateJob
     * @summary Buat job layanan retail (Superadmin, Koordinator, Subkoordinator)
     * @request POST:/api/retail/jobs
     * @secure
     */
    retailCreateJobControllerCreateJob: (
      data: CreateRetailJobDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/retail/jobs`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Layanan Retail Non-RO
     * @name RetailGetJobControllerGetJob
     * @summary Detail job layanan retail (Superadmin, Koordinator, Subkoordinator, Superadmin, Keuangan (Legacy), Keuangan - Billing, Keuangan - Bendahara, Keuangan - KARWAS)
     * @request GET:/api/retail/jobs/{id}
     * @secure
     */
    retailGetJobControllerGetJob: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/retail/jobs/${id}`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Layanan Retail Non-RO
     * @name RetailUpdateJobControllerUpdateJob
     * @summary Perbarui job dan status layanan retail (Superadmin, Koordinator, Subkoordinator)
     * @request PATCH:/api/retail/jobs/{id}
     * @secure
     */
    retailUpdateJobControllerUpdateJob: (
      id: string,
      data: UpdateRetailJobDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/retail/jobs/${id}`,
        method: "PATCH",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Layanan Retail Non-RO
     * @name RetailSummaryControllerSummary
     * @summary Ringkasan tagihan dan penerimaan layanan retail (Superadmin, Koordinator, Subkoordinator, Superadmin, Keuangan (Legacy), Keuangan - Billing, Keuangan - Bendahara, Keuangan - KARWAS)
     * @request GET:/api/retail/summary
     * @secure
     */
    retailSummaryControllerSummary: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/retail/summary`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Layanan Retail Non-RO
     * @name RetailUploadJobDocumentControllerUploadJobDocument
     * @summary Unggah dokumen job retail (Superadmin, Koordinator, Subkoordinator)
     * @request POST:/api/retail/jobs/{id}/documents/{jenis}
     * @secure
     */
    retailUploadJobDocumentControllerUploadJobDocument: (
      id: string,
      jenis: string,
      data: {
        /** @format binary */
        file: File;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/retail/jobs/${id}/documents/${jenis}`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.FormData,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Layanan Retail Non-RO
     * @name RetailRecordLhuHandoverControllerRecordLhuHandover
     * @summary Catat serah terima LHU layanan retail (Superadmin, Koordinator, Subkoordinator)
     * @request POST:/api/retail/jobs/{id}/serah-terima-lhu
     * @secure
     */
    retailRecordLhuHandoverControllerRecordLhuHandover: (
      id: string,
      data: {
        /** @format binary */
        file: File;
        /** @format date */
        tanggal_serah_terima: string;
        /** @maxLength 200 */
        nama_penerima: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/retail/jobs/${id}/serah-terima-lhu`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.FormData,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Layanan Retail Non-RO
     * @name RetailListExpensesControllerListExpenses
     * @summary Daftar pengajuan belanja retail (Superadmin, Koordinator, Subkoordinator, Superadmin, Keuangan (Legacy), Keuangan - Billing, Keuangan - Bendahara, Keuangan - KARWAS)
     * @request GET:/api/retail/pengajuan-belanja
     * @secure
     */
    retailListExpensesControllerListExpenses: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        status?: string;
        status_invoice?: "DRAFT" | "DITERBITKAN" | "LUNAS" | "DIBATALKAN";
        unit_pelaksana_id?: string;
        /** @example 2026 */
        tahun_fiscal?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/retail/pengajuan-belanja`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Layanan Retail Non-RO
     * @name RetailCreateExpenseControllerCreateExpense
     * @summary Ajukan belanja layanan retail (Superadmin, Koordinator, Subkoordinator)
     * @request POST:/api/retail/jobs/{id}/pengajuan-belanja
     * @secure
     */
    retailCreateExpenseControllerCreateExpense: (
      id: string,
      data: CreateRetailExpenseDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/retail/jobs/${id}/pengajuan-belanja`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Layanan Retail Non-RO
     * @name RetailReviewExpenseControllerReviewExpense
     * @summary Review pengajuan belanja retail (Superadmin, Keuangan - KARWAS)
     * @request POST:/api/retail/pengajuan-belanja/{id}/review
     * @secure
     */
    retailReviewExpenseControllerReviewExpense: (
      id: string,
      data: ReviewRetailExpenseDto,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/retail/pengajuan-belanja/${id}/review`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Layanan Retail Non-RO
     * @name RetailUploadExpenseDocumentControllerUploadExpenseDocument
     * @summary Unggah dokumen pengajuan belanja retail (Superadmin, Koordinator, Subkoordinator)
     * @request POST:/api/retail/pengajuan-belanja/{id}/dokumen
     * @secure
     */
    retailUploadExpenseDocumentControllerUploadExpenseDocument: (
      id: string,
      data: {
        /** @format binary */
        file: File;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/retail/pengajuan-belanja/${id}/dokumen`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.FormData,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Layanan Retail Non-RO
     * @name RetailCancelExpenseControllerCancelExpense
     * @summary Batalkan pengajuan belanja retail (Superadmin, Koordinator, Subkoordinator)
     * @request POST:/api/retail/pengajuan-belanja/{id}/batal
     * @secure
     */
    retailCancelExpenseControllerCancelExpense: (
      id: string,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/retail/pengajuan-belanja/${id}/batal`,
        method: "POST",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Layanan Retail Non-RO
     * @name RetailPayExpenseControllerPayExpense
     * @summary Bayar pengajuan belanja retail (Superadmin, Keuangan - Bendahara)
     * @request POST:/api/retail/pengajuan-belanja/{id}/bayar
     * @secure
     */
    retailPayExpenseControllerPayExpense: (
      id: string,
      data: {
        nomor_pembayaran: string;
        /** @format date */
        tanggal_bayar: string;
        catatan?: string;
        /** @format binary */
        file: File;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/retail/pengajuan-belanja/${id}/bayar`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.FormData,
        ...params,
      }),
  };
}
