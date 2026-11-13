# APK EDITING

Aplikasi editing video berbasis web oleh BYHASSSTUDIO. Status: **v19** (sistem inti ala Alight Motion / CapCut: gizmo, multi-select, salin-tempel, kunci layer, kurva bezier, gradien, bayangan, motion path, parent/grup layer, pen tool dan layer vektor, preset). Efek, transisi, dan filter sengaja belum dibuat.

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

### Edit 3D (tombol "✦ Edit 3D" di beranda)

Pengedit dan tracking 3D, **bukan** pembuat model 3D. Ruang 3D dengan kamera (posisi, putar, roll, FOV), layer teks / foto / video, parent (grup/orbit), hadap kamera (billboard), keyframe + kurva gerak, efek layar (pisah warna, glow, getar kamera, kilat), latar kipas, pita cahaya, debu bintang, musik, export video real-time. Seret objek langsung di preview.

- **Tracking titik**: pilih layer video, tekan "Lacak titik", ketuk objek, mulai lacak, lalu tempel ke teks/foto: layer mengikuti objek lewat keyframe otomatis.
- **Contoh referensi**: Lirik 3D Warp (kata terbang menembus kamera), Foto Terowongan 3D, Kartu Foto Orbit, Tracking teks, Kosong.
- File: `js/scene3d.js`, `css/scene3d.css`. Project 3D disimpan di IndexedDB sendiri (`apk-3d`).

### v12 (sistem vektor, bagian 1 dari 3)

- **Pena (✒ Pena atau tombol P)**: ketuk di preview untuk membuat titik, tarik saat mengetuk untuk membuat lengkung bezier, ketuk titik awal (cincin hijau) untuk menutup path. Enter = selesai path, Esc = keluar dari mode Pena. Setiap path baru menjadi layer vektor baru di timeline.
- **Edit titik langsung di preview**: pilih layer vektor lalu seret titik atau handle (masuk/keluar). Ketuk dua kali pada titik = ubah sudut/halus (kotak = sudut, bulat = halus). Ketuk dua kali pada garis = sisip titik tanpa mengubah bentuk. Delete = hapus titik terpilih. Semua juga ada sebagai tombol di panel Properti (untuk layar sentuh).
- **Banyak isi dan garis per layer**, digambar berurutan (bisa dinaikkan, diturunkan, dihapus): warna polos, gradien linear, gradien radial, opacity, lebar, ujung garis, sambungan sudut, garis putus-putus, aturan isi nonzero / even-odd, bayangan. Pengaturan lanjutan ada di mode Lanjutan.
- **Sub-path** (tombol + Sub-path) untuk beberapa path dalam satu layer; dengan aturan even-odd bisa dipakai membuat lubang.
- **Bentuk dasar bisa diubah jadi path vektor** (tombol "Ubah jadi path vektor" di panel Properti, mode Lanjutan); isi, gradien, garis, dan bayangan ikut terbawa.
- Layer vektor bisa di-keyframe untuk posisi, scale, opacity, dan rotasi, bisa jadi anak/induk, dan ikut ter-export seperti layer lainnya.
- Data tersimpan di field opsional `clip.vec` (project lama tidak berubah dan tetap terbuka). Rincian format ada di komentar awal `js/vector.js`.

### v19: regang, miring, titik pusat, animasi cepat, filter, transisi
- **Panjangkan / pendekkan (regang)**: selain Scale yang membesarkan atau mengecilkan seragam, kini lebar dan tinggi bisa diubah terpisah. Di preview tarik **kotak kuning di tengah sisi** objek (kiri/kanan = lebar, atas/bawah = tinggi). Di panel Properti ada slider "Panjangkan / pendekkan lebar / tinggi (%)". Berlaku untuk video, gambar, teks, bentuk, dan vektor. Bisa di-keyframe dan ikut direkam oleh Kurva otomatis.
- **Miring (skew)** horizontal dan vertikal (slider di Properti, bisa di-keyframe). Kotak pilihan di preview tetap persegi panjang biasa (tidak ikut miring), tapi hasil gambarnya benar.
- **Titik pusat (anchor)**: poros putar dan zoom bisa digeser (X dan Y px dari tengah objek) di bagian "Titik pusat" panel Properti. Tidak di-keyframe. Tombol Reset mengembalikannya ke tengah.
- **Animasi cepat**: di Properti pilih animasi masuk, keluar, atau loop (pop, zoom, geser dari 4 arah, jatuh memantul, putar, melebar/meninggi, miring, denyut, napas, goyang, melayang, memantul, berkedip, getar, berputar terus, dan lain-lain; 35 total). Hasilnya **keyframe biasa** yang tetap bisa diubah. Lama masuk, keluar, dan satu siklus loop bisa diatur. Memilih "tidak ada" menghapusnya dan mengembalikan nilai diam. Masuk, keluar, dan loop bisa dipakai bersamaan.
- **Filter dan efek** (per clip, nilainya tetap): blur, kecerahan, kontras, saturasi, rona warna, hitam putih, sepia, negatif untuk semua jenis layer; **vignette, pemisah RGB, dan glitch** hanya untuk video dan gambar. Ada 8 preset filter (hitam putih, vintage, sinematik, cerah, dramatis, mimpi, glitch, negatif) dan "Hapus semua filter". Filter tidak bisa di-keyframe.
- **Transisi** di awal dan akhir clip: memudar, geser 4 arah, zoom dari kecil/besar, putar, blur, wipe 4 arah, dan buka lingkaran (iris), dengan lama bisa diatur. Untuk transisi antar dua clip: beri clip pertama transisi keluar dan clip kedua transisi masuk, lalu letakkan berimpit atau bertumpuk di layer berbeda.
- Semua di atas ikut tersimpan di project dan di file preset, dan ikut ter-export. Filter memakai `ctx.filter`, yang didukung Chrome, Edge, dan Firefox; di browser yang belum mendukung (Safari lama) efek filter diabaikan.

### Kurva otomatis (auto-keyframe, rekam langsung)
- Tombol **⏺ Kurva otomatis** ada di bar timeline (setelah Grup). Nyalakan, lalu di preview muncul tombol **▶ Mulai**.
- Tekan Mulai: hitung mundur **3 detik**, lalu **timeline langsung berjalan sendiri** dan mode **● MEREKAM** aktif. Selama berjalan, setiap kali objek digeser, di-zoom (scale), atau diputar di preview (juga lewat slider Posisi, Scale, Opacity, Rotasi di panel Properti), gerakannya direkam otomatis sebagai keyframe di waktu yang sedang berjalan. Tidak perlu menekan ◇ satu-satu.
- Keyframe hasil rekam memakai easing linear dan dijarangkan (sekitar 20 per detik) supaya gerakan mulus dan datanya tidak membengkak. Kalau properti pertama kali diberi keyframe di waktu lebih dari 0, nilai awalnya otomatis dikunci di awal clip supaya gerakan mulai dari posisi semula.
- Rekaman berhenti lewat tombol **■ Berhenti**, tombol pause di preview, atau saat timeline sampai ujung (timeline ikut berhenti). Mode tetap menyala sehingga bisa Mulai lagi. **Tutup** atau menekan tombol Kurva otomatis lagi mematikan mode. Satu langkah Undo membatalkan satu gerakan (satu kali geser).
- **Grafik kurva kecepatan** (pilihan jenis kurva dan editor bezier dua titik putih) ada di **bawah daftar Media** (di ponsel: tab Media), bukan di panel Properti. Tampil di mode Lanjutan.

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
