export function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function niceScale(distanceMeters) {
  const pow10 = Math.pow(10, Math.floor(Math.log10(Math.max(distanceMeters, 0.001))))
  const candidates = [1, 2, 5, 10].map((m) => m * pow10)
  let best = candidates[0]
  for (const c of candidates) {
    if (c <= distanceMeters) best = c
  }
  return best
}

export function fmtDist(m) {
  return m >= 1000 ? Math.round(m / 100) / 10 + ' km' : Math.round(m) + ' m'
}

export function nowStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export const ESRI_SAT =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

export const OSM_STREET = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

export const MODE_LABEL = {
  WA: {
    full: 'Peta Wilayah Administrasi',
    color: '#1868B0',
    desc: 'Peta WA memuat seluruh batas SLS/Sub-SLS yang ada di dalam desa/kelurahan terpilih. Pilih kecamatan dan desa, lalu generate.',
    dbDesc: 'Status peta WA per desa/kelurahan pada kecamatan terpilih.',
  },
  WS: {
    full: 'Peta Satuan Lingkungan Setempat (SLS)',
    color: '#3F9142',
    desc: 'Peta WS menampilkan batas satu SLS (RT/RW/Dusun) secara utuh. Pilih kecamatan, desa, lalu SLS yang dituju.',
    dbDesc: 'Status peta WS per SLS pada desa/kelurahan terpilih.',
  },
  WSS: {
    full: 'Peta Wilayah Sub Satuan Lingkungan Setempat (Sub-SLS)',
    color: '#F5921E',
    desc: 'Peta WSS memperjelas satu sub-bagian di dalam SLS. Jika SLS tidak terbagi sub-SLS, peta WSS akan identik dengan peta WS-nya.',
    dbDesc: 'Status peta WSS per SLS pada desa/kelurahan terpilih.',
  },
}
