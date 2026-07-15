const API_BASE = import.meta.env.VITE_API_BASE || '/api'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json || json.status !== 'success') {
    throw new Error(json?.message || `Permintaan gagal (HTTP ${res.status})`)
  }
  return json
}

// ---- Basis data peta WA/WS/WSS (TemplateView) ----

export async function fetchSavedMaps({ mode, idkec, iddesa } = {}) {
  const q = new URLSearchParams()
  if (mode) q.set('mode', mode)
  if (idkec) q.set('idkec', idkec)
  if (iddesa) q.set('iddesa', iddesa)
  const qs = q.toString()
  const json = await request(`/maps.php${qs ? `?${qs}` : ''}`)
  return json.data // array baris peta_tersimpan
}

export async function saveMap({ map_key, mode, idkec, iddesa, idsls = null, idsubsls = null, label }) {
  return request('/maps.php', {
    method: 'POST',
    body: JSON.stringify({ map_key, mode, idkec, iddesa, idsls, idsubsls, label }),
  })
}

export async function deleteMap(map_key) {
  return request(`/maps.php?map_key=${encodeURIComponent(map_key)}`, { method: 'DELETE' })
}

// ---- WS-Inset tersimpan (InsetView) ----

export async function fetchInsets(idsls) {
  const qs = idsls ? `?idsls=${encodeURIComponent(idsls)}` : ''
  const json = await request(`/insets.php${qs}`)
  return json.data // array inset, center sudah berbentuk {lat, lng}
}

export async function saveInset(item) {
  const json = await request('/insets.php', {
    method: 'POST',
    body: JSON.stringify(item),
  })
  return json.data // item lengkap dengan id dari database
}

export async function deleteInset(id) {
  return request(`/insets.php?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}