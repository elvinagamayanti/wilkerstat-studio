// Ekspor elemen lembar peta (.sheet) ke PNG / PDF
// Dipakai oleh TemplateView.jsx dan InsetView.jsx
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

// Elemen UI interaktif yang tidak boleh ikut tercetak di hasil ekspor
const HIDE_SELECTORS = [
  '.map-toolbar',          // tombol zoom/reset di InsetView
  '.map-basemap-toggle',   // toggle Satelit/Jalan di InsetView
  '.inset-target-badge',   // badge nama SLS di pojok peta inset
  '.leaflet-control-container',
]

async function captureSheet(el) {
  // Tunggu satu frame agar render Leaflet terakhir selesai
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)))

  return html2canvas(el, {
    scale: 3,                 // 3x resolusi layar → tajam saat dicetak
    useCORS: true,            // muat ulang tile basemap dengan CORS agar canvas tidak "tainted"
    backgroundColor: '#ffffff',
    logging: false,
    onclone: (doc) => {
      HIDE_SELECTORS.forEach((sel) =>
        doc.querySelectorAll(sel).forEach((n) => (n.style.display = 'none')),
      )
    },
  })
}

function triggerDownload(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function exportSheetPNG(el, filename = 'peta.png') {
  const canvas = await captureSheet(el)
  await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('gagal membuat berkas PNG'))
      const url = URL.createObjectURL(blob)
      triggerDownload(url, filename)
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      resolve()
    }, 'image/png')
  })
}

export async function exportSheetPDF(el, filename = 'peta.pdf') {
  const canvas = await captureSheet(el)
  // JPEG kualitas tinggi agar ukuran PDF tidak membengkak
  const img = canvas.toDataURL('image/jpeg', 0.95)
  const landscape = canvas.width >= canvas.height
  const pdf = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a3', // lembar .sheet memang berproporsi seri-A (aspect-ratio 1.4142)
  })
  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()
  // muat penuh halaman dengan proporsi terjaga, ditengahkan
  const ratio = Math.min(pw / canvas.width, ph / canvas.height)
  const w = canvas.width * ratio
  const h = canvas.height * ratio
  pdf.addImage(img, 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h)
  pdf.save(filename)
}

// Nama berkas aman: "Peta WA / DESA MADELLO" → "Peta-WA-DESA-MADELLO"
export function safeFileName(s) {
  return s
    .toString()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}