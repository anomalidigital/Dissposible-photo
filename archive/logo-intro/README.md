# Logo intro (arsip)

Animasi intro **logo LOL jatuh dari atas → mengayun → lensa merah membuka →
zoom menembus lubang** untuk masuk ke sesi foto. Diganti oleh "circle wipe" di
commit `234dfa5`. Disimpan di sini kalau sewaktu-waktu mau dipakai lagi.

## Isi folder
- `logo-lens.webp` — grafis logo dengan lubang transparan di tengah (1000×1000, RGBA).
- `index-with-logo-intro.html` — salinan utuh `index.html` pada commit `46b2ed6`
  (versi terakhir yang masih punya intro logo). Tinggal ambil bagian yang perlu.

## Bagian kode yang relevan (di `index-with-logo-intro.html`)
- **CSS** (± baris 883–975): `.cam-anim`, `.cam-rig`, `.cam-iris`, `.cam-rig-img`,
  `.cam-lens`, dan `@keyframes camIntro / irisOpen / lensOpen`.
- **HTML** (± baris 1363): `<div class="cam-anim" id="cam-anim"> … </div>`.
- **JS** (± baris 1432): `function playCameraIntro()`.
- **Aset**: `logo-lens.webp`.

## Catatan teknis (kenapa mulus)
`.cam-iris` membesarkan lubang lewat **`width`/`height`** (bukan `transform`/
`clip-path`), dengan `box-shadow` gelap raksasa. Box-shadow di-repaint tiap frame
sehingga tepinya **tetap tajam di ukuran berapa pun** (men-`scale` box-shadow
bikin blur). Mekanisme iris inilah yang dipakai ulang untuk circle wipe baru.
