# APK EDITING

Aplikasi editing video berbasis web oleh BYHASSSTUDIO. Status: **v11** (sistem inti ala Alight Motion / CapCut: gizmo, multi-select, salin-tempel, kunci layer, kurva bezier, gradien, bayangan, motion path, parent/grup layer). Efek, transisi, dan filter sengaja belum dibuat.

## Buka di web

https://byhasstudio.github.io/apk-editing/

(Aktifkan GitHub Pages: Settings > Pages > Source: Deploy from a branch > Branch `main`, folder `/ (root)`. Repo harus public untuk akun gratis.)

## Fitur yang sudah berfungsi

- Halaman utama: project terakhir, tanggal edit, buka, hapus
- Project baru: nama, rasio aspek, resolusi, FPS
- Simpan manual (Ctrl+S), autosave 4 detik; penyimpanan IndexedDB; simpan/buka file `.apkedit.json`
- Import media (MP4, MOV, WEBM, MP3, WAV, PNG, JPG, JPEG, WEBP) lewat tombol atau drag and drop
- Preview canvas: play, pause, stop, volume, fullscreen, rasio aspek
- Timeline multi-track: geser, trim, split, duplikat, hapus, urutan layer, mute, zoom, snap, waveform
- Teks, bentuk, dan stiker; chroma key, mask, blend, flip, kecepatan, putar mundur, fade audio
- Keyframe animasi (x, y, scale, opacity, rotasi, volume) dengan easing bawaan
- Undo/redo (hingga 100 langkah)
- Export video (MP4 jika didukung browser, selain itu WebM) dengan audio ter-mix

### v10

- **Gizmo di preview**: klik objek lalu geser, tarik sudut untuk scale, tarik titik bulat untuk memutar (Shift = kelipatan 15°, Alt = matikan snap ke tengah)
- **Multi-select**: Shift/Ctrl + klik, atau tombol Pilih banyak di ponsel; geser, duplikat, hapus, dan split banyak clip sekaligus; Ctrl+A pilih semua
- **Salin / Potong / Tempel** (Ctrl+C / X / V atau tombol) di posisi playhead
- **Kunci dan sembunyikan layer** per track (ikon gembok dan mata)
- **Graph editor** kurva bezier kustom untuk easing keyframe
- **Gradien warna, bayangan, dan stroke** untuk teks dan bentuk
- **Mode Sederhana / Lanjutan**, tooltip di semua tombol, tutorial singkat saat pertama membuka editor (tombol ?)
- **Export PNG**: simpan frame di posisi playhead (resolusi mengikuti preview, maks. 1280 px sisi terpanjang)

### v11

- **Parent / grup layer**: tombol ▣ Grup membuat layer kosong; di panel Properti pilih "Induk" pada clip lain. Anak ikut bergerak, membesar, berputar, dan memudar bersama induknya (bisa berantai). Mengganti induk tidak membuat clip melompat selama posisinya tidak beranimasi.
- **Motion path** (mode Lanjutan): aktifkan "Jalur gerak" di panel Properti, lalu seret titik jalur di preview. Pilihan kecepatan gerak, jalur melengkung atau lurus, dan hadap arah gerak.

## Rencana berikutnya

Pen tool (vektor), export GIF dan hanya audio, lalu efek dan transisi.

## Menjalankan lokal

Buka `index.html` di browser, atau jalankan server lokal: `python3 -m http.server`.

## Teknologi

HTML5, CSS3, JavaScript (tanpa build step), IndexedDB, Canvas 2D, Web Audio API, MediaRecorder.
