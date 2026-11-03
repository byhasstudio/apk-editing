# APK EDITING

Aplikasi editing video berbasis web oleh BYHASSSTUDIO. Status: **Tahap 4 selesai** (fondasi, media, preview, timeline, audio, properti, undo/redo).

## Buka di web
https://byhasstudio.github.io/apk-editing/

(Aktifkan GitHub Pages: Settings > Pages > Source: Deploy from a branch > Branch `main`, folder `/ (root)`.)

## Fitur yang sudah berfungsi
- Halaman utama: project terakhir, tanggal edit, buka, hapus
- Project baru: nama, rasio aspek, resolusi, FPS
- Simpan manual (Ctrl+S), autosave 4 detik, indikator "Belum disimpan"
- Penyimpanan IndexedDB; simpan/buka project dari file `.apkedit.json`
- Import media (MP4, MOV, WEBM, MP3, WAV, PNG, JPG, JPEG, WEBP) lewat tombol atau drag and drop, dengan thumbnail, durasi, dan ukuran file
- Preview canvas: play, pause, stop, volume, fullscreen, rasio aspek, waktu playback
- Timeline multi-track (video, audio, gambar): geser, trim, split, duplikat, hapus, urutan layer, mute track, zoom, scroll, snap
- Waveform pada clip audio
- Panel properti clip: waktu mulai, durasi, waktu selesai, volume, posisi X/Y, scale, opacity, rotasi (langsung terlihat di preview)
- Undo/redo (hingga 100 langkah)
- Shortcut: Space, Delete, Ctrl+Z, Ctrl+Y, Ctrl+S, Ctrl+D, S (split), panah kiri/kanan, Home, End

## Belum selesai
Export video (Tahap 5). Efek, transisi, dan filter sengaja belum dibuat.

## Menjalankan lokal
Buka `index.html` di browser, atau jalankan server lokal: `python3 -m http.server`.

## Teknologi
HTML5, CSS3, JavaScript (tanpa build step), IndexedDB, Canvas 2D, Web Audio API.
