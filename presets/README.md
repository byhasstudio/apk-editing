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
