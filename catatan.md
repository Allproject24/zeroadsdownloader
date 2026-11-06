# Catatan Proyek — Malz Bypass URL

## Ringkasan

Aplikasi web untuk memproses tautan pendek yang didukung dan mengunduh file hasilnya. Alur tautan dan pengiriman file berjalan melalui situs ini.

## Struktur proyek

- `artifacts/sfile-web-downloader/` — antarmuka React + Vite, form tautan, status proses, dan penyimpanan file ke perangkat pengguna.
- `artifacts/api-server/` — API Express untuk membuat dan memantau pekerjaan serta mengirim file hasil unduhan. API masih memiliki endpoint pembatalan, tetapi tombol batal tidak ditampilkan di antarmuka.
- `lib/api-spec/openapi.yaml` — kontrak API sumber utama.
- `lib/api-client-react/` dan `lib/api-zod/` — klien React dan skema validasi yang dihasilkan dari kontrak API.

## Alur unduhan

1. Pengguna memasukkan URL lengkap.
2. Halaman mengirim URL ke `POST /api/downloads`.
3. Server memeriksa domain yang didukung dan memproses alur tautan di browser.
4. Halaman mengambil status pekerjaan secara berkala tanpa cache.
5. Jika selesai, pengguna dapat menyimpan file melalui tombol **Simpan**. Jika Safefileku meminta verifikasi manusia, aplikasi menampilkan URL yang dapat disalin atau dibuka untuk melanjutkan di situs tersebut.

Status pekerjaan: `queued`, `running`, `completed`, `failed`, `blocked`, dan `cancelled`.

## Tautan yang didukung

- `sfl.gl`
- `safelinku.com`
- `sfile.co`
- `sfile.mobi`
- `safefileku.com`

## Menjalankan dan memeriksa

Jalankan layanan melalui workflow proyek:

- Web: `pnpm --filter @workspace/sfile-web-downloader run dev`
- API: `pnpm --filter @workspace/api-server run dev`

Pemeriksaan tipe seluruh proyek: `pnpm run typecheck`

Jika kontrak API diubah, buat ulang klien dan skema:

```sh
pnpm --filter @workspace/api-spec run codegen
```

## Catatan pemeliharaan

- Ikuti tampilan terbaru: kartu hitam dengan garis tipis, palet hitam-putih/abu-abu, dan font sans-serif yang rapi.
- Kolom URL harus tetap gelap saat fokus/autofill dan hanya memakai indikator fokus membulat; jangan tampilkan outline persegi pada input.
- Tampilkan domain yang benar-benar didukung API; jangan mencantumkan layanan lain yang belum diproses.
- Empat label fitur tetap terlihat selama unduhan berjalan; tampilkan satu spinner dan timer mulai dari `1s` di tombol **Bypass**.
- Jangan tampilkan tombol **Batalkan** pada antarmuka.
- Jangan tampilkan urutan klik dan waktu tunggu internal selama unduhan berlangsung.
- Pertahankan pengambilan status dengan `cache: no-store` agar tampilan tidak memakai status lama.
- Perubahan alur download harus tetap memvalidasi domain dan menjaga pembatalan, status gagal, serta panduan verifikasi manual.
