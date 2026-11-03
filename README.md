# APK EDITING

Aplikasi editing video berbasis web oleh BYHASSSTUDIO. Status: **Tahap 3 selesai** (fondasi, media, preview, timeline).

## Fitur yang sudah berfungsi
- Halaman utama: project terakhir, tanggal edit, buka, hapus
- Project baru: nama, rasio aspek, resolusi, FPS
- Simpan manual (Ctrl+S), autosave 4 detik, indikator "Belum disimpan"
- Penyimpanan IndexedDB; simpan/buka project dari file `.apkedit.json`
- Import media (MP4, MOV, WEBM, MP3, WAV, PNG, JPG, JPEG, WEBP) lewat tombol atau drag and drop, dengan thumbnail, durasi, dan ukuran file
- Preview canvas: play, pause, stop, volume, fullscreen, rasio aspek, waktu playback
- Timeline multi-track (video, audio, gambar): geser, trim, split, duplikat, hapus, urutan layer, mute track, zoom, scroll, snap
- Shortcut: Space, Delete, Ctrl+D, Ctrl+S, S (split), panah kiri/kanan, Home, End

## Belum selesai
Waveform audio, panel properti clip, undo/redo (Tahap 4), export video (Tahap 5). Efek, transisi, dan filter sengaja belum dibuat.

## Menjalankan
Buka `index.html` di browser, atau jalankan server lokal: `python3 -m http.server`.

## Teknologi
HTML5, CSS3, JavaScript (tanpa build step), IndexedDB, Canvas 2D.
