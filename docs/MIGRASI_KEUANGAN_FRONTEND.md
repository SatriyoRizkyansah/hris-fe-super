# Spesifikasi Migrasi `keuangan-frontend` ke `keuangan-super-frontend`

## 1. Tujuan

Pindahkan seluruh kapabilitas bisnis dari `../keuangan-frontend` ke aplikasi Next.js di folder ini.

**Yang berubah:** shell/template visual. Gunakan `Topbar`, `Sidebar`, `Shell`, token CSS, gaya kartu, tombol, tabel, dan modal milik `keuangan-super-frontend`.

**Yang tidak boleh berubah:** perilaku bisnis, endpoint API, kontrak request/response, validasi, hak akses, urutan aksi, filter, pencarian, pagination, unggah/lihat berkas, modal/form, detail data, dan penempatan informasi per halaman.

Migrasi ini bukan copy-paste komponen React Router/MUI. Bangun ulang halaman dengan App Router Next.js dan komponen template, sambil mempertahankan feature parity dari aplikasi sumber.

## 2. Batasan Arsitektur

| Area         | Sumber                                       | Target                                                                                            |
| ------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Framework    | React 19 + Vite                              | Next.js 14 App Router + React 18                                                                  |
| Routing      | `react-router-dom`                           | file-based routes di `app/`                                                                       |
| UI           | Material UI                                  | CSS template, `components/ui`, Base UI/Lucide bila perlu                                          |
| Server state | TanStack Query                               | Tetap TanStack Query melalui `components/QueryProvider.tsx`                                       |
| API client   | `src/hook/api-*.tsx`                         | `lib/api/generated/api-generated.ts` dan wrapper/hook target                                      |
| API schema   | `http://localhost:3002/api/webapp-docs-json` | default `http://localhost:3001/api/webapp-docs-json`; pastikan URL backend final sebelum generate |
| Auth         | signal + cookie JWT                          | Next cookie/session, middleware, client/server boundary yang aman                                 |

### Larangan

- Jangan pindahkan `node_modules`, build output, MUI, React Router, atau signal lama.
- Jangan mengubah backend/API untuk menyesuaikan UI target.
- Jangan menghapus role guard, validasi, aksi tabel, modal, atau halaman detail karena belum ada komponen target.
- Jangan menaruh token, password, atau secret di `NEXT_PUBLIC_*`.
- Jangan mengubah URL publik tanpa redirect/keputusan eksplisit. Pertahankan path lama pada tabel route di bawah.

## 3. Sumber Kebenaran

1. **Perilaku bisnis:** `../keuangan-frontend/src/pages/`, `src/hook/`, `src/common/`.
2. **Route dan role:** `../keuangan-frontend/src/routes/index.tsx`.
3. **Template visual:** folder `app/`, `components/`, dan `app/globals.css` di project target.
4. **Kontrak API target:** hasil `npm run codeGen`, backend Swagger aktif, dan request runtime aplikasi sumber.

Jika ada konflik, perilaku bisnis sumber dipertahankan; UI mengikuti template target. Catat konflik di bagian keputusan sebelum mengubah perilaku.

## 4. Aturan Implementasi

### 4.1 Struktur target

```text
app/
  login/page.tsx
  (dashboard)/                  # route group; tidak muncul pada URL
    layout.tsx                  # Shell bersama; memakai components/Shell.tsx
    page.tsx                    # URL: /
    pegawai/page.tsx            # URL: /pegawai
    proyek/[id]/page.tsx        # URL: /proyek/:id
    ...
components/
  hris/                         # komponen domain reusable hasil ekstraksi
  table/                        # primitive tabel target
  modal/                        # primitive modal target
lib/
  api/generated/                # output codegen; jangan edit manual
  api/                          # client, query key, adapter, hook domain
  auth.ts
```

- Untuk mempertahankan URL lama, pindahkan/ubah `app/dashboard/layout.tsx` menjadi layout route group `app/(dashboard)/layout.tsx`. Folder `(dashboard)` tidak menambah `/dashboard` pada URL.
- Bila URL `/dashboard/*` dipilih tim, buat redirect kompatibilitas dari URL lama dan ubah tabel route ini lewat keputusan eksplisit.
- Halaman interaktif diberi `"use client"` seminimal mungkin.
- Layout route dashboard memakai `components/Shell.tsx`; jangan diganti per halaman.
- Komponen reusable dibuat di target. Jangan duplikasi modal/tabel/form yang sama per halaman.
- Hasil codegen tidak diedit manual. Buat adapter/hook di luar `lib/api/generated/`.
- Semua error API, loading, empty state, toast/sukses, dan confirm delete harus konsisten dengan template.

### 4.2 Visual dan UX

- Sidebar dan topbar wajib memakai template target. Tambah item menu target berdasarkan role.
- Gunakan token di `app/globals.css`; jangan membawa CSS/MUI theme lama.
- Pertahankan label, field, urutan field, default value, required state, helper/error text, tabel kolom, aksi baris, filter, pagination, dan informasi summary dari sumber.
- Modal target boleh berubah gaya, tetapi isi, state, validasi, aksi `Simpan/Batal/Hapus`, dan efek setelah aksi harus sama.
- Desktop, sidebar collapse, dan mobile drawer template tetap berfungsi.
- Aksesibilitas minimum: label input terhubung, fokus modal, Escape/overlay close sesuai aksi aman, tombol ikon punya `aria-label`, state loading tidak dapat submit berulang.

## 5. Inventaris Route dan Role

Buat semua route ini dalam kelompok `app/dashboard/` kecuali login. Gunakan URL lama agar bookmark/menu tetap kompatibel.

| URL lama/target         | Halaman sumber                                                | Role di sumber                                      |
| ----------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| `/login`                | `pages/auth/LoginPage.tsx`                                    | guest only                                          |
| `/`                     | `pages/dashboard/HrisDashboard.tsx`                           | authenticated                                       |
| `/pegawai`              | `pages/master-pegawai/PegawaiPage.tsx`                        | `superadmin`, `koordinator`                         |
| `/unit-kerja`           | `pages/master-unit/UnitKerjaPage.tsx`                         | `superadmin`, `koordinator`                         |
| `/proyek`               | `pages/master-proyek/ProyekPage.tsx`                          | `superadmin`, `koordinator`, `keuangan`, `pimpinan` |
| `/proyek/:id`           | `pages/master-proyek/ProyekDetailPage.tsx`                    | `superadmin`, `koordinator`, `keuangan`, `pimpinan` |
| `/ro`                   | `pages/master-ro/RoPage.tsx`                                  | `superadmin`, `koordinator`, `keuangan`             |
| `/ro/:id`               | `pages/master-ro/RoDetailPage.tsx`                            | `superadmin`, `koordinator`, `keuangan`             |
| `/dana-operasional`     | `pages/master-dana-operasional/DanaOperasionalPage.tsx`       | `superadmin`, `koordinator`, `keuangan`             |
| `/dana-operasional/:id` | `pages/master-dana-operasional/DanaOperasionalDetailPage.tsx` | `superadmin`, `koordinator`, `keuangan`             |
| `/rekening`             | `pages/master-rekening/MasterRekeningPage.tsx`                | `superadmin`, `keuangan`                            |
| `/mak`                  | `pages/master-mak/MasterMakPage.tsx`                          | `superadmin`, `keuangan`                            |
| `/sk`                   | `pages/sk/SkPage.tsx`                                         | `superadmin`, `koordinator`                         |
| `/alokasi-gaji`         | `pages/alokasi-gaji/AlokasiGajiPage.tsx`                      | `superadmin`, `koordinator`, `keuangan`             |
| `/alokasi-gaji/rekap`   | `pages/alokasi-gaji/RekapAlokasiPage.tsx`                     | `superadmin`, `koordinator`, `keuangan`             |
| `/rekonsiliasi-bank`    | `pages/rekonsiliasi-bank/RekonsiliasiBankPage.tsx`            | `superadmin`, `keuangan`                            |
| `/pengguna`             | `pages/users/UsersPage.tsx`                                   | `superadmin`                                        |
| `/profil`               | `pages/profil/ProfilPage.tsx`                                 | semua role authenticated                            |
| `/pengaturan-margin`    | `pages/pengaturan-margin/PengaturanMarginPage.tsx`            | `superadmin`                                        |

Role tersedia: `superadmin`, `koordinator`, `subkoor`, `keuangan`, `pimpinan`, `spi`, `karyawan`.

## 6. Tahap Kerja Wajib

### Tahap 0 — Baseline

- Jalankan aplikasi sumber dan target.
- Buat matriks parity per halaman: route, role, endpoint, query parameter, tabel, filter, aksi, modal, form field, validasi, upload/download, redirect, dan status selesai.
- Ambil screenshot desktop dan mobile halaman sumber sebagai bukti perilaku, bukan referensi desain.
- Pastikan URL Swagger backend yang benar; sesuaikan `LEMIGAS_API_SCHEMA_URL` bila perlu lalu jalankan `npm run codeGen` di target.

### Tahap 1 — Fondasi target

- Lengkapi API client/hook, error normalizer, QueryProvider, auth backend, session/cookie aman, middleware, role resolver, dan route authorization.
- Pindahkan daftar role, enum, format tanggal/angka, dan utilitas bisnis dari sumber setelah disesuaikan ke target.
- Buat primitive target: data table server-side, filter/select searchable, date picker, file upload/viewer, dialog confirm, modal form, status badge, toast/loading/empty/error state.
- Sidebar menampilkan menu sesuai role dan path aktif benar.

### Tahap 2 — Migrasi bertahap

Urutan disarankan:

1. Login, auth guard, dashboard, profil.
2. Master: unit kerja, pegawai, proyek + detail, RO + detail, dana operasional + detail, rekening, MAK.
3. Transaksi: SK, alokasi gaji, rekap alokasi, rekonsiliasi bank.
4. Sistem: pengguna, pengaturan margin.

Satu halaman dinyatakan selesai hanya bila seluruh daftar cek parity halaman terpenuhi.

### Tahap 3 — Hardening

- Uji tiap role pada menu, URL langsung, dan aksi terlarang.
- Uji create/read/update/delete, pagination, filter, sort bila ada, pencarian, reset filter, validasi, error API, loading, modal, upload, preview/download file.
- Uji refresh browser, deep link halaman detail, browser back/forward, desktop dan mobile.
- Hapus atau tandai jelas placeholder/template demo yang sudah tidak dipakai.

## 7. Checklist Parity per Halaman

Salin checklist ini untuk setiap halaman dalam issue/PR atau tabel tracking.

- [ ] Route target dan redirect setelah aksi sama dengan sumber.
- [ ] Auth dan role guard sama; akses URL langsung yang tidak berhak ditolak.
- [ ] Endpoint, method, payload, query parameter, dan mapping response sama.
- [ ] Semua data, kolom, status, angka, tanggal, dan summary tampil benar.
- [ ] Search, filter, sort, pagination, reset, dan empty state sama.
- [ ] Semua tombol/aksi tabel sama: termasuk detail, edit, hapus, submit, approve bila ada.
- [ ] Semua modal: field, urutan, default value, dependent field, validasi, upload/preview, submit/cancel sama.
- [ ] Sukses/error/loading/confirmasi dan refresh cache/list bekerja.
- [ ] Desktop dan mobile sesuai shell template target.
- [ ] Tidak ada import MUI, React Router, atau signal dari aplikasi sumber.

## 8. Kriteria Selesai

Migrasi selesai bila:

1. Semua route pada inventaris tersedia dan berfungsi.
2. Semua role mendapat menu dan izin identik dengan sumber.
3. Semua fitur sumber lolos checklist parity.
4. Sidebar, topbar, card, modal, tabel, tombol, dan responsive layout mengikuti template target.
5. `npm run build` target lulus tanpa TypeScript error.
6. Test otomatis minimal mencakup login/guard, satu CRUD representatif, role restriction, dan deep-link detail. Playwright tersedia di target.
7. Tidak ada demo auth/API atau dummy data tersisa pada alur produksi, kecuali disetujui dan didokumentasikan.

## 9. Keputusan yang Harus Dikonfirmasi Sebelum Coding

- URL Swagger/backend final: sumber memakai port `3002`; target default memakai `3001`.
- Mekanisme auth produksi: endpoint login, bentuk token/session, refresh token, logout, dan sumber role.
- Base path deploy: apakah route tetap root (`/pegawai`) atau dibungkus prefix aplikasi (`/dashboard/pegawai`). Dokumen ini mengasumsikan URL lama dipertahankan.
- Kontrak file upload/download/preview dan lokasi penyimpanan berkas.
- Halaman/fitur sumber yang sengaja tidak ikut dipindah.

## 10. Catatan Keputusan

| Tanggal    | Keputusan                   | Alasan                                                               | PIC |
| ---------- | --------------------------- | -------------------------------------------------------------------- | --- |
| 2026-10-17 | Memulai spesifikasi migrasi | Menjaga feature parity sambil mengganti shell UI ke Next.js template | -   |
