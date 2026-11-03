# APK EDITING

Aplikasi editing video berbasis web oleh BYHASSSTUDIO. Status: **v15** (sistem inti ala Alight Motion / CapCut: gizmo, multi-select, salin-tempel, kunci layer, kurva bezier, gradien, bayangan, motion path, parent/grup layer, pen tool dan layer vektor, preset). Efek, transisi, dan filter sengaja belum dibuat.

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

### v12 (sistem vektor, bagian 1 dari 3)

- **Pena (✒ Pena atau tombol P)**: ketuk di preview untuk membuat titik, tarik saat mengetuk untuk membuat lengkung bezier, ketuk titik awal (cincin hijau) untuk menutup path. Enter = selesai path, Esc = keluar dari mode Pena. Setiap path baru menjadi layer vektor baru di timeline.
- **Edit titik langsung di preview**: pilih layer vektor lalu seret titik atau handle (masuk/keluar). Ketuk dua kali pada titik = ubah sudut/halus (kotak = sudut, bulat = halus). Ketuk dua kali pada garis = sisip titik tanpa mengubah bentuk. Delete = hapus titik terpilih. Semua juga ada sebagai tombol di panel Properti (untuk layar sentuh).
- **Banyak isi dan garis per layer**, digambar berurutan (bisa dinaikkan, diturunkan, dihapus): warna polos, gradien linear, gradien radial, opacity, lebar, ujung garis, sambungan sudut, garis putus-putus, aturan isi nonzero / even-odd, bayangan. Pengaturan lanjutan ada di mode Lanjutan.
- **Sub-path** (tombol + Sub-path) untuk beberapa path dalam satu layer; dengan aturan even-odd bisa dipakai membuat lubang.
- **Bentuk dasar bisa diubah jadi path vektor** (tombol "Ubah jadi path vektor" di panel Properti, mode Lanjutan); isi, gradien, garis, dan bayangan ikut terbawa.
- Layer vektor bisa di-keyframe untuk posisi, scale, opacity, dan rotasi, bisa jadi anak/induk, dan ikut ter-export seperti layer lainnya.
- Data tersimpan di field opsional `clip.vec` (project lama tidak berubah dan tetap terbuka). Rincian format ada di komentar awal `js/vector.js`.

### v13-v15 (preset)

- Tombol **⬇ Preset** dan **⬆ Preset** ada di bar paling atas editor (sebelum tombol Mode).
- **⬇ Preset (simpan)**: sekali klik langsung mengambil SEMUA layer di project (teks, bentuk, vektor, grup, dan clip media) lengkap dengan keyframe, jalur gerak, data vektor, hubungan induk-anak, serta struktur track (urutan, nama, mute, kunci, sembunyi). Beri nama, lalu browser mengunduh file `nama.apkpreset.json`. Kalau hanya ingin sebagian, pilih 2 clip atau lebih dulu (Shift/Ctrl + klik, atau Pilih banyak).
- **⬆ Preset (buka)**: pilih satu atau beberapa file preset. Layer dikembalikan **persis seperti aslinya** (waktu mulai sama, urutan dan nama track sama, semua properti sama), tanpa digeser ke playhead. Hasilnya clip biasa sehingga bisa diedit, dan file aslinya tidak berubah. Satu langkah Undo menghapusnya. File preset format lama (v13/v14) tetap bisa dibuka.
- **Media ikut tersimpan.** Kalau layer yang disimpan memakai foto, video, atau audio, isi filenya ikut dimasukkan ke file preset (jadi `nama.apkpreset`, bukan `.json`), sehingga preset bisa dibuka di project baru tanpa impor ulang media. Ukuran file preset ikut membesar sesuai ukuran media; kalau lebih dari 300 MB kamu ditanya dulu. Saat dibuka, media yang sudah ada di project (id sama, atau nama, jenis, dan ukuran sama) dipakai lagi, hanya yang belum ada yang diimpor. Preset tanpa media tetap berupa file `.apkpreset.json` kecil. Preset lama yang tidak menyimpan media tetap bisa dibuka; clip medianya tersambung kalau project punya media dengan nama dan jenis yang sama.
- Membuka preset ke project yang sama TIDAK menumpuk salinan: layer yang isinya sama persis dengan yang sudah ada dilewati (kamu diberi tahu jumlahnya), jadi aman dibuka berkali-kali. Hanya layer yang belum ada yang ditambahkan.

## Rencana berikutnya

Sistem vektor bagian 2 (gambar bebas dengan penghalusan, gabung/kurangi/irisan path), bagian 3 (path vektor sebagai motion path dan mask), lalu keyframe lanjutan (titik path, anchor, skew, graph editor penuh), mask/matte, precomp, teks lanjutan, audio, presisi, dan export. Efek dan transisi menyusul belakangan. Perpustakaan preset di dalam aplikasi (tanpa file) termasuk prioritas 7.

## Menjalankan lokal

Buka `index.html` di browser, atau jalankan server lokal: `python3 -m http.server`.

## Teknologi

HTML5, CSS3, JavaScript (tanpa build step), IndexedDB, Canvas 2D, Web Audio API, MediaRecorder.
