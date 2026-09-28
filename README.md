# Wedding Photobooth — LOL Photobooth

Photobooth web untuk tamu acara: buka link di perangkat apa saja (HP, foldable,
tablet, desktop, smart display), ambil 2 foto, pilih filter vintage, lalu simpan
photo strip-nya. Dibangun dengan **Angular 22** dan **Bootstrap 5.3**.

## Menjalankan di lokal

```bash
npm install
npm start        # dev server di http://localhost:4200
npm run build    # hasil produksi di dist/lol-photobooth/browser
```

Kamera browser hanya jalan di `https://` atau `localhost`.

## Ganti acara

- Nama pasangan dan teks home: `src/app/event.config.ts`
- Template strip: `public/assets/template-artworks.webp`; posisi dua lubang
  fotonya ada di `STRIP_TEMPLATE` (`src/app/core/imaging.ts`)
- Filter vintage (kurva warna, vignette, grain): `src/app/core/vintage.ts`

## Struktur

| Folder | Isi |
| --- | --- |
| `src/app/screens/home` | Home pernikahan, buket bunga SVG prosedural (`floral.ts`) |
| `src/app/screens/camera` | Kamera full-screen dengan bingkai 3:2 (yang di dalam bingkai = yang tersimpan) |
| `src/app/screens/confirm` | Preview foto di template yang dipegang tangan + pemilih filter |
| `src/app/screens/processing` | Pembuatan photo strip |
| `src/app/screens/delivery` | Download strip + foto |
| `src/app/core` | Kamera, sesi, filter vintage, komposit strip, helper animasi |
| `src/styles.scss` | Bootstrap (modul yang dipakai saja) + komponen kamera bersama |

## Deploy

Setiap push ke `main` di-build dan dipublikasikan oleh
`.github/workflows/deploy.yml`. Syarat satu kali di GitHub:
**Settings → Pages → Build and deployment → Source: GitHub Actions**.
