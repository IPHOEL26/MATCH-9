# MATCH-9 — Tampilan GitHub Pages

Folder ini berisi halaman aplikasi yang dapat langsung diunggah ke GitHub Pages tanpa proses build.

## Berkas utama

- `index.html` — susunan halaman;
- `style.css` — warna dan tampilan;
- `script.js` — fungsi aplikasi dan komunikasi dengan GAS;
- `config.js` — tempat menempel URL Web App GAS;
- `assets/og.png` — gambar pratinjau ketika tautan dibagikan;
- `assets/context/*.webp` — ilustrasi ringan untuk hubungan materi dengan kehidupan nyata.

Sebelum mengunggah, tempel URL GAS berakhiran `/exec` pada `config.js`. Jangan menaruh PIN guru atau jawaban materi pada folder ini.

Versi penyempurnaan memiliki:

- enam tema warna cerah;
- tampilan responsif: lanskap lebar di laptop dan tetap nyaman di HP;
- menu utama yang turun dari tombol Σ serta tombol layar penuh;
- materi bertahap satu fokus per layar;
- notasi matematika melalui MathJax;
- pilihan kelas 9-4 dan 9-2;
- game prasyarat empat murid dengan empat soal berbeda;
- bank 100 soal prasyarat per submateri yang tidak berulang antarputaran dan antarkelas;
- tahap Latihan Bersama yang mengambil lima soal baru setiap kali;
- 100 variasi tugas lapangan per submateri dengan tugas berbeda untuk tiap kelas;
- nilai diagnostik 50–100 yang muncul dan tersimpan saat murid selesai;
- pemeriksaan kategori Jago, Standar, dan Cemen serta tombol perbaikan;
- reset nilai tes per kelas dan submateri dengan konfirmasi;
- input nilai tugas lapangan dengan penanda murid yang belum dinilai;
- pemuatan cepat melalui cache lokal dan cache Google Apps Script.

Panduan lengkap terdapat pada `../PANDUAN-MATCH-9.md` di komputer Kak Iphoel.
