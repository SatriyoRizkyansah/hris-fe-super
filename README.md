# LEMIGAS Super Apps — Template Login & Dashboard

Next.js 14 (App Router) + TypeScript, tanpa library UI tambahan (CSS biasa, token di `app/globals.css`).

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:3000
```

Mode demo: email/username dan kata sandi apa pun diterima.

## Struktur

- `app/login/page.tsx` — form login (validasi, tampil/sembunyi sandi, ingat saya, loading, error)
- `app/dashboard/*` — Beranda, Aplikasi, Profil, Bantuan (satu layout bersama)
- `components/` — `Topbar`, `Sidebar` (bisa diperkecil / drawer di mobile), `AppCard`, `Logo`, `Skyline`
- `lib/apps.ts` — daftar aplikasi; tambah entri baru untuk kartu baru
- `lib/auth.ts` + `middleware.ts` — autentikasi tiruan berbasis cookie

## Konfigurasi API

1. Salin `.env.example` menjadi `.env.local`.
2. Isi `NEXT_PUBLIC_API_BASE_URL` bila browser perlu memanggil backend secara langsung.
3. Isi `API_BASE_URL` untuk request dari route handler/server-side Next.js.
4. Jangan simpan token, kata sandi, atau secret di variabel `NEXT_PUBLIC_*`.

Template tidak mengirim request API secara default. Login memakai sesi lokal sementara. Ganti alur di `app/login/page.tsx` saat autentikasi backend siap.

## Yang perlu Anda ganti

1. **Logo resmi**: timpa aset logo sesuai kebutuhan.
2. **Warna & ukuran**: ubah variabel di bagian `:root` pada `app/globals.css`.
3. **Autentikasi**: ganti sesi lokal di `app/login/page.tsx` dan `lib/auth.ts` dengan SSO/API backend.

# lemigas-frontend-template
# template-fe-lemgias
# hris-fe-super
