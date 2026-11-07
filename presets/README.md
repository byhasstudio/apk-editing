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
