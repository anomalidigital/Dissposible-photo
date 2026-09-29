# Wedding Photobooth — LOL Photobooth

Photobooth web untuk tamu acara: buka link di perangkat apa saja (HP, foldable,
tablet, desktop, smart display), ambil 2 foto, pilih filter vintage, lalu simpan
photo strip-nya. Dibangun dengan **Angular 22** dan **Bootstrap 5.3**.

## Isi repo

| Lokasi | Isi |
| --- | --- |
| Root (`index.html`, `main-*.js`, `styles-*.css`, `img/`, `favicon.png`) | Situs yang tayang di GitHub Pages. **Hasil build — jangan diedit manual.** |
| `source/` | Proyek Angular — semua perubahan dilakukan di sini. |

GitHub Pages menayangkan root branch `main` apa adanya ("Deploy from a branch",
tanpa GitHub Actions). Jadi setiap perubahan di `source/` harus di-build ulang
ke root sebelum di-commit.

## Menjalankan di lokal

```bash
cd source
npm install
npm start        # dev server di http://localhost:4200
```

Kamera browser hanya jalan di `https://` atau `localhost`. Untuk mencoba situs
jadi di root, sajikan foldernya dengan server statis apa saja, misalnya
`python -m http.server 8765`, lalu buka http://localhost:8765 (membuka
`index.html` langsung dari disk tidak akan jalan).

## Menayangkan perubahan

```bash
cd source
npm run build:site   # build produksi + salin ke root
```

Lalu commit perubahan di `source/` **dan** file di root, buat pull request, dan
merge ke `main`. Skrip hanya mengganti file yang ia tayangkan sebelumnya
(dicatat di `.site-files`); file lain di root tidak disentuh.

## Ganti acara

- Nama pasangan dan teks home: `source/src/app/event.config.ts`
- Template strip: `source/public/img/template-artworks.webp`; posisi dua lubang
  fotonya ada di `STRIP_TEMPLATE` (`source/src/app/core/imaging.ts`)
- Filter vintage (kurva warna, vignette, grain): `source/src/app/core/vintage.ts`

## Struktur kode (`source/src/app`)

| Folder | Isi |
| --- | --- |
| `screens/home` | Home pernikahan, buket bunga SVG prosedural (`floral.ts`) |
| `screens/camera` | Kamera full-screen dengan bingkai 3:2 (yang di dalam bingkai = yang tersimpan) |
| `screens/confirm` | Preview foto di template yang dipegang tangan + pemilih filter |
| `screens/processing` | Pembuatan photo strip |
| `screens/delivery` | Download strip + foto |
| `core` | Kamera, sesi, filter vintage, komposit strip, helper animasi |
| `../styles.scss` | Bootstrap (modul yang dipakai saja) + komponen kamera bersama |
