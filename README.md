# Wilkerstat Studio — React JS

Migrasi dari prototipe HTML tunggal (`wilkerstat-studio-prototype.html`) ke project React + Vite.

## Menjalankan

```bash
npm install
npm run dev      # buka http://localhost:5173
npm run build    # build produksi ke dist/
```

## Struktur hasil migrasi

```
src/
├── main.jsx                  # entry point (import leaflet.css + index.css)
├── App.jsx                   # layout utama + state mode aktif (WA/WS/WSS/INSET)
├── index.css                 # seluruh CSS prototipe (dipindahkan apa adanya)
├── utils.js                  # hashStr, niceScale, fmtDist, nowStr, MODE_LABEL, URL basemap
├── data/
│   ├── kec.json              # GeoJSON kecamatan (diekstrak dari <script id="KEC_DATA">)
│   ├── desa.json             # GeoJSON desa (dari DESA_DATA)
│   ├── sls.json              # GeoJSON SLS/Sub-SLS (dari SLS_DATA)
│   └── index.js              # pengayaan properti + lookup + getSlsGroupsForDesa
├── assets/
│   └── bps-logo.png          # logo BPS (diekstrak dari base64 di prototipe)
└── components/
    ├── Topbar.jsx            # header + jam WITA
    ├── Rail.jsx              # sidebar jenis peta + statistik cakupan
    ├── Toast.jsx             # ToastProvider + hook useToast
    ├── TemplateView.jsx      # mode WA/WS/WSS: select berjenjang, generate, basis data mock
    ├── MapSheet.jsx          # lembar peta kartografis (Leaflet, skala, legenda, QR, lokator)
    └── InsetView.jsx         # mode WS-Inset: pencarian SLS, toolbar peta, simpan inset
```

## Catatan migrasi

- **Data GeoJSON** yang sebelumnya tertanam di dalam HTML (±1,1 MB) dipisah menjadi file JSON
  di `src/data/` dan di-import langsung oleh Vite.
- **Leaflet dipakai langsung** (bukan react-leaflet) di dalam `useEffect` + `ref` agar logika
  fitBounds, divIcon label area, dan perhitungan skala tetap identik dengan prototipe.
- Semua state DOM imperatif (mode aktif, seleksi berjenjang, daftar basis data,
  inset tersimpan, modal, toast) dikonversi menjadi React state/hooks.
- Ekspor PNG/PDF masih simulasi (toast) seperti prototipe — dependensi `html2canvas` dan
  `jspdf` sudah tersedia di package.json bila ingin diimplementasikan sungguhan pada
  elemen `.sheet`.
- Perilaku dipertahankan: pindah mode WA↔WS↔WSS mereset pilihan desa ke bawah tetapi
  mempertahankan kecamatan; peta inset tetap ter-mount saat berpindah mode.
