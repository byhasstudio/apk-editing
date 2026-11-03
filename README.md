# APK EDITING

Aplikasi editing video berbasis web oleh BYHASSSTUDIO. Status: **Tahap 6 selesai** (sistem utama lengkap + keyframe animasi).

## Buka di web
https://byhasstudio.github.io/apk-editing/

(Aktifkan GitHub Pages: Settings > Pages > Source: Deploy from a branch > Branch `main`, folder `/ (root)`. Repo harus public untuk akun gratis.)

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
- Shortcut: Space, Delete, Ctrl+Z, Ctrl+Y, Ctrl+S, Ctrl+D, S (split), K (keyframe semua), [ dan ] (loncat keyframe), panah kiri/kanan, Home, End
- Export video: pilih format (MP4 jika browser mendukung, selain itu WebM), resolusi, FPS, dan kualitas; audio ikut ter-mix. Berjalan real-time lewat MediaRecorder, jadi lamanya sama dengan durasi timeline dan tab harus tetap terlihat

### Keyframe animasi (baru)
- Properti yang bisa dianimasikan: posisi X/Y, scale, opacity, rotasi, volume
- Tombol ◇ di samping tiap properti: tambah/hapus keyframe di playhead; tombol ◀ ▶ untuk loncat antar keyframe
- Auto-keyframe: setelah properti beranimasi, mengubah nilainya di playhead otomatis membuat/mengubah keyframe
- Penanda keyframe (diamond kuning) di clip pada timeline: klik untuk loncat ke waktunya, geser untuk memindah (ikut snap)
- Kurva animasi per keyframe: Linear, Halus (Ease In-Out), Ease In, Ease Out, Overshoot, Bounce, Hold
- Tombol "Semua" (K) untuk keyframe semua properti visual sekaligus, "Hapus di playhead", dan "Reset" animasi clip
- Keyframe ikut terjaga saat split (nilai disambung di titik potong), duplikat, trim kiri, undo/redo, simpan, dan export

## Belum selesai
Efek, transisi, filter, dan preset sengaja belum dibuat (tahap berikutnya). Export belum memakai FFmpeg, jadi dukungan MP4 bergantung pada browser (Chrome terbaru umumnya mendukung).

## Menjalankan lokal
Buka `index.html` di browser, atau jalankan server lokal: `python3 -m http.server`.

## Teknologi
HTML5, CSS3, JavaScript (tanpa build step), IndexedDB, Canvas 2D, Web Audio API, MediaRecorder.
