# Folder preset

Preset di folder ini otomatis muncul di galeri tombol **✦ Preset** (beranda), jadi semua pengguna bisa memakainya tanpa file.

## Menambah preset
1. Susun hasil edit di editor, pastikan fotonya sudah dipasang di timeline.
2. Tekan **⬇ Preset Foto**, simpan file `.apktemplate`.
3. Taruh file itu di folder `presets/` (opsional: gambar sampul `.jpg`/`.png`, rasio 3:4 paling pas).
4. Tambahkan satu entri di `index.json`:

```json
{
  "presets": [
    {
      "id": "liburan-1",
      "name": "Liburan Seru",
      "desc": "3 foto, transisi cepat",
      "file": "liburan-1.apktemplate",
      "cover": "liburan-1.jpg"
    }
  ]
}
```

`file` dan `cover` hanya berupa nama file di folder ini. `cover` boleh dikosongkan.

## Preset berbentuk file teks
File `.apktemplate` juga boleh berupa JSON biasa (bukan biner). Foto bawaannya ditaruh di `media[].b64` (base64), jadi file bisa dibaca dan diubah di GitHub. Contoh: `kilau-matcha.apktemplate` (3 foto, dibuat dari analisis video referensi: fade-in, zoom-out dengan isi cermin lalu putar, hentakan zoom + flip horizontal + blur sesuai beat, siklus hue, fade putih ke hitam).

`dentum-flip.apktemplate` (3 foto, tanpa filter/efek): gerakan diukur dari video referensi, yaitu fade-in dari gelap, push-in, zoom-whip antar foto, foto miring, flip horizontal pendek sesuai beat, geser turun, lalu fade hitam. Keyframe-nya tanpa easing per ruas, jadi dihaluskan kurva kubik monotonik oleh editor (gerak mengalir, tidak patah atau berhenti-jalan). Foto bawaannya hanya placeholder netral.

`kamu-kasi-3-foto.apktemplate` ("kamu yang kasi tinggal 3 foto", 3 foto, tanpa filter/efek): gerakan diukur dari video referensi. Tiap foto dipasang dua kali: latar (diperbesar, bergeser halus) dan kartu foto membulat (mask "Persegi membulat" 77%) di atas lapisan hitam redup. Foto 1 fade-in dari gelap lalu kartu bergetar halus; foto 2 masuk lewat kartu miring yang berputar edge-on, zoom-whip, kartu membesar dari kecil, whip kedua, lalu kartu kembali kecil dan melebar; foto 3 kartu menyusut dari besar, menyusut-membesar sesuai beat, whip vertikal, lalu fade hitam. Flip horizontal pendek (±0,23 dtk) di 9,83 / 11,07 / 11,83 / 13,87 / 15,9 dtk. Keyframe tanpa easing per ruas (dihaluskan editor). Foto bawaannya placeholder netral.

`kamu-kasi-3-foto.apktemplate` juga membawa lagu bawaan (`lagu.mp3`, diambil dari video referensi, 17,3 dtk) di track "Lagu", fade out 0,4 dtk. Yang bisa diganti pengguna tetap hanya 3 foto; lagunya ikut otomatis ke project dan bisa diubah di timeline.

Foto bawaan semua preset foto (Kilau Matcha, Dentum Flip, Jatuh Hanyut, Malam Getar, kamu yang kasi tinggal 3 foto) sekarang memakai 3 foto makanan (720×1280). Preset dengan 1 foto (Malam Getar) memakai foto pertama. Lirik Merah Kinetik tidak berubah.

`stone-paradox.apktemplate` ("Stone Paradox 1 Foto", 4:3 960×720, 60 fps, 26,2 dtk, tanpa filter/efek): gerakan, ukuran, getaran, dan warna diukur frame demi frame dari video referensi. Hanya 1 foto yang bisa diganti (foto orang, 0 sampai 7,9 dtk); sisanya teks. Isi: foto fade-in dengan getar halus + kartu kutipan putih (dua baris teks sebagai anak kartu, ikut bergetar ±3 px), lalu kartu membesar dan memudar sambil foto zoom-in gelap, judul "Stone Paradox" (S besar + huruf kapital kecil) muncul, wash merah singkat; teks kinetik "Kelihatannya cuma ada dua kemungkinan" (kata bertambah rata kiri lalu naik dan mengecil), "BISA / Berarti dia tidak mahakuasa" (zoom bertahap + wash merah), "TIDAK BISA / Berarti dia tidak mahakuasa" (zoom dan miring ±6°), "Tapi tunggu." dengan kedip putih-hitam (teks memakai blend `difference`), "Kenapa harus menerima dua pilihan itu?" hitam di latar putih (kata besar `dua` `pilihan` `itu?`), "Pertanyakan dulu premisnya", "MUNGKIN masalahnya bukan di JAWABANNYA" yang menyusut, dan "Tapi pada pertanyaannya.". Semua keyframe tanpa easing per ruas dan klip diberi `smooth:true` agar mengalir. Font memakai daftar fallback (Oswald untuk sans kondensasi, Cinzel untuk serif); ukuran teks diukur untuk Oswald. Blur gerak, partikel bintang, dan watermark sengaja belum dibuat (efek menyusul). Foto bawaannya placeholder netral kecil.
