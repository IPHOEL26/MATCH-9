# MATCH-9 — PWA GitHub Pages (Versi 7)

Folder ini berisi halaman aplikasi yang dapat langsung diunggah ke GitHub Pages tanpa proses build.

## Berkas utama

- `index.html` — susunan halaman;
- `style.css` — warna dan tampilan;
- `script.js` — fungsi aplikasi dan komunikasi dengan GAS;
- `config.js` — tempat menempel URL Web App GAS;
- `manifest.webmanifest` dan `sw.js` — pemasangan aplikasi, cache versi, dan materi offline;
- `assets/icons/*.png` — ikon M9 ukuran 192 dan 512 piksel;
- `assets/og.png` — gambar pratinjau ketika tautan dibagikan;
- `assets/context/*.webp` — ilustrasi ringan untuk hubungan materi dengan kehidupan nyata.

Sebelum mengunggah, tempel URL GAS berakhiran `/exec` pada `config.js`. Jangan menaruh PIN guru atau jawaban materi pada folder ini.

Versi 7 memiliki:

- PWA yang dapat dipasang di HP/laptop, tombol pembaruan, materi offline, dan antrean sinkronisasi;
- jalur terpisah untuk Mode Presentasi, Ruang Guru, Ruang Murid, serta Latihan/Tamu;
- kode akses pribadi murid; data murid, nilai, kunci, dan Bekal Cepat Guru tidak ikut dalam data publik;
- permainan 10 soal acak yang dinilai server; tiket set soal mencegah perubahan ID soal dan pengiriman tidak lengkap;
- tugas dengan batas waktu, jumlah percobaan, hasil terbaik, rubrik, bukti foto privat, serta riwayat nilai;
- Mode Presentasi dengan slide Bekal Cepat Guru yang seluruh isinya bersumber dari Google Sheet;

- enam tema warna cerah;
- tampilan responsif: lanskap lebar di laptop dan tetap nyaman di HP;
- menu utama yang turun dari logo M9 serta tombol layar penuh;
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
- tombol cepat `＋` untuk jawaban lisan, dikte, keaktifan, dan kemampuan menjelaskan;
- input manual STS/SAS dari halaman depan;
- perhitungan otomatis TP, LM, NF, NSLM, Nontes, Nilai Asli, dan NR;
- rekap dengan peringatan tugas, Nontes, STS, atau SAS yang belum lengkap;
- tombol untuk menyiapkan format nilai cetak di Google Sheet;
- pemuatan cepat melalui cache lokal dan cache Google Apps Script.

Panduan lengkap terdapat pada `../PANDUAN-MATCH-9.md` di komputer Kak Iphoel.
