import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { SLS } from '../data'
import { ESRI_SAT, OSM_STREET, nowStr } from '../utils'
import { useToast } from './Toast'

export default function InsetView({ active }) {
  const showToast = useToast()

  const mapDivRef = useRef(null)
  const mapRef = useRef(null)
  const satRef = useRef(null)
  const streetRef = useRef(null)
  const boundaryRef = useRef(null)
  const templateViewRef = useRef(null)

  const [query, setQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [currentSls, setCurrentSls] = useState(null)
  const [boundaryOn, setBoundaryOn] = useState(true)
  const [basemap, setBasemap] = useState('sat')
  const [savedInsets, setSavedInsets] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalName, setModalName] = useState('')
  const wrapRef = useRef(null)

  // buat peta sekali
  useEffect(() => {
    const map = L.map(mapDivRef.current, {
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: true,
    }).setView([-4.4, 119.6], 10)
    const sat = L.tileLayer(ESRI_SAT, { maxZoom: 19, opacity: 1 }).addTo(map)
    const street = L.tileLayer(OSM_STREET, { maxZoom: 19, subdomains: 'abc', opacity: 0 }).addTo(map)
    mapRef.current = map
    satRef.current = sat
    streetRef.current = street
    return () => map.remove()
  }, [])

  // invalidasi ukuran saat view aktif
  useEffect(() => {
    if (active && mapRef.current) {
      setTimeout(() => mapRef.current.invalidateSize(), 50)
    }
  }, [active])

  // toggle basemap
  useEffect(() => {
    if (!satRef.current || !streetRef.current) return
    if (basemap === 'sat') {
      satRef.current.setOpacity(1)
      streetRef.current.setOpacity(0)
    } else {
      satRef.current.setOpacity(0)
      streetRef.current.setOpacity(1)
    }
  }, [basemap])

  // tutup dropdown saat klik di luar
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setDropdownOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const q = query.trim().toLowerCase()
  let matches = []
  if (q) {
    const seen = new Set()
    matches = SLS.features
      .filter((f) => {
        const p = f.properties
        if (seen.has(p.idsubsls)) return false
        const hit =
          p.idsls.toLowerCase().includes(q) ||
          p.nmsls.toLowerCase().includes(q) ||
          p.nmdesa.toLowerCase().includes(q)
        if (hit) seen.add(p.idsubsls)
        return hit
      })
      .slice(0, 40)
  }

  const selectSls = (feature) => {
    setCurrentSls(feature)
    setBoundaryOn(true)
    const map = mapRef.current
    if (boundaryRef.current) map.removeLayer(boundaryRef.current)
    const groupFeats = SLS.features.filter(
      (f) => f.properties.idsls === feature.properties.idsls,
    )
    boundaryRef.current = L.geoJSON(
      { type: 'FeatureCollection', features: groupFeats },
      {
        style: {
          color: '#FFD54A',
          weight: 2.5,
          fillColor: '#FFD54A',
          fillOpacity: 0.12,
          dashArray: '6,4',
        },
      },
    ).addTo(map)
    map.fitBounds(boundaryRef.current.getBounds(), { padding: [40, 40], maxZoom: 18 })
    setTimeout(() => {
      map.invalidateSize()
      templateViewRef.current = { center: map.getCenter(), zoom: map.getZoom() }
    }, 150)
  }

  const toggleBoundary = () => {
    const map = mapRef.current
    if (!boundaryRef.current) return
    if (map.hasLayer(boundaryRef.current)) {
      map.removeLayer(boundaryRef.current)
      setBoundaryOn(false)
    } else {
      boundaryRef.current.addTo(map)
      setBoundaryOn(true)
    }
  }

  const openSaveModal = () => {
    if (!currentSls) return
    setModalName(`WS-Inset ${savedInsets.length + 1}`)
    setModalOpen(true)
  }

  const confirmSave = () => {
    const map = mapRef.current
    const name = modalName.trim() || `WS-Inset ${savedInsets.length + 1}`
    const item = {
      id: 'ins_' + Date.now(),
      name,
      idsls: currentSls.properties.idsls,
      nmsls: currentSls.properties.nmsls,
      nmdesa: currentSls.properties.nmdesa,
      nmkec: currentSls.properties.nmkec,
      center: map.getCenter(),
      zoom: map.getZoom(),
      basemap,
      savedAt: nowStr(),
    }
    setSavedInsets((prev) => [...prev, item])
    setModalOpen(false)
    showToast(`${name} berhasil disimpan`)
  }

  const openSaved = (item) => {
    const feat = SLS.features.find((f) => f.properties.idsls === item.idsls)
    if (feat) selectSls(feat)
    setTimeout(() => {
      mapRef.current.setView(item.center, item.zoom)
      setBasemap(item.basemap)
    }, 200)
    showToast(`Membuka ${item.name}`)
  }

  const deleteSaved = (item) => {
    setSavedInsets((prev) => prev.filter((s) => s.id !== item.id))
    showToast(`${item.name} dihapus`)
  }

  return (
    <div className={`view inset-view${active ? ' active' : ''}`}>
      <div className="config-col">
        <h2 className="section-head">WS-Inset</h2>
        <p className="section-desc">
          Cari ID atau nama SLS untuk memuat peta acuan dari template pusat. Geser dan perbesar
          peta sesuai kebutuhan, lalu simpan sebagai inset baru.
        </p>
        <div className="field">
          <label>Cari SLS (ID atau nama)</label>
          <div className="search-input-wrap" ref={wrapRef}>
            <input
              className="txt"
              placeholder="mis. 73100300030001 atau RT 01…"
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setDropdownOpen(!!e.target.value.trim())
              }}
              onFocus={() => {
                if (query.trim()) setDropdownOpen(true)
              }}
            />
            <div className={`dropdown-list${dropdownOpen && q ? ' open' : ''}`}>
              {matches.length === 0 ? (
                <div className="dropdown-empty">Tidak ditemukan</div>
              ) : (
                matches.map((f) => {
                  const p = f.properties
                  const sub = p.kdsubsls !== '00' ? ` (Sub-SLS ${p.kdsubsls})` : ''
                  return (
                    <div
                      key={p.idsubsls}
                      className="dropdown-item"
                      onClick={() => {
                        setQuery(`${p.idsls} — ${p.nmsls}`)
                        setDropdownOpen(false)
                        selectSls(f)
                      }}
                    >
                      <span>
                        {p.nmsls}
                        {sub}
                        <br />
                        <span style={{ color: '#93A2AF' }}>
                          {p.nmdesa}, {p.nmkec}
                        </span>
                      </span>
                      <span className="id">{p.idsls}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
        <div className="divider-line"></div>
        <h2 className="section-head" style={{ fontSize: 13 }}>
          Daftar WS-Inset Tersimpan
        </h2>
        {savedInsets.length === 0 && (
          <p className="section-desc">Belum ada WS-Inset yang disimpan pada sesi ini.</p>
        )}
        <div className="saved-list">
          {savedInsets
            .slice()
            .reverse()
            .map((item) => (
              <div className="saved-item" key={item.id}>
                <div className="saved-thumb">⌖</div>
                <div className="saved-info">
                  <div className="saved-name">{item.name}</div>
                  <div className="saved-meta">
                    {item.idsls} · zoom {item.zoom} · {item.basemap === 'sat' ? 'Satelit' : 'Jalan'}
                  </div>
                </div>
                <div className="saved-actions">
                  <button className="icon-btn" title="Buka" onClick={() => openSaved(item)}>
                    ⤢
                  </button>
                  <button className="icon-btn" title="Hapus" onClick={() => deleteSaved(item)}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="inset-map-wrap">
        <div id="insetMap" ref={mapDivRef}></div>

        {currentSls && (
          <div className="inset-target-badge">
            <div className="id">{currentSls.properties.idsls}</div>
            <div className="nm">
              {currentSls.properties.nmsls} · Desa {currentSls.properties.nmdesa}, Kec.{' '}
              {currentSls.properties.nmkec}
            </div>
          </div>
        )}

        {currentSls && (
          <div className="map-toolbar" style={{ display: 'flex' }}>
            <button className="tb-btn" title="Perbesar" onClick={() => mapRef.current.zoomIn()}>
              ＋
            </button>
            <button className="tb-btn" title="Perkecil" onClick={() => mapRef.current.zoomOut()}>
              －
            </button>
            <button
              className="tb-btn"
              title="Kembali ke tampilan template"
              onClick={() => {
                if (templateViewRef.current)
                  mapRef.current.setView(templateViewRef.current.center, templateViewRef.current.zoom)
              }}
            >
              ⟲
            </button>
            <button
              className={`tb-btn${boundaryOn ? ' active' : ''}`}
              title="Tampilkan/sembunyikan batas SLS"
              onClick={toggleBoundary}
            >
              ▦
            </button>
          </div>
        )}

        {currentSls && (
          <div className="map-basemap-toggle" style={{ display: 'flex' }}>
            <button
              className={`bm-opt${basemap === 'sat' ? ' active' : ''}`}
              onClick={() => setBasemap('sat')}
            >
              Satelit
            </button>
            <button
              className={`bm-opt${basemap === 'street' ? ' active' : ''}`}
              onClick={() => setBasemap('street')}
            >
              Jalan
            </button>
          </div>
        )}

        {currentSls && (
          <div className="save-bar" style={{ display: 'flex' }}>
            <button className="btn btn-primary" onClick={openSaveModal}>
              💾 Simpan sebagai WS-Inset
            </button>
          </div>
        )}

        {!currentSls && (
          <div
            className="empty-state"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div>
              <div className="glyph">⌖</div>
              <h3>Belum ada SLS dipilih</h3>
              <p>Cari ID atau nama SLS di panel kiri untuk memuat peta acuan.</p>
            </div>
          </div>
        )}
      </div>

      <div
        className={`modal-overlay${modalOpen ? ' show' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalOpen(false)
        }}
      >
        <div className="modal-box">
          <h3>Simpan WS-Inset</h3>
          <p>
            Beri nama untuk peta inset ini. Tampilan (posisi &amp; zoom) saat ini akan disimpan
            bersama nama tersebut.
          </p>
          <div className="field">
            <label>Nama Inset</label>
            <input
              className="txt"
              value={modalName}
              onChange={(e) => setModalName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmSave()
              }}
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setModalOpen(false)}>
              Batal
            </button>
            <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={confirmSave}>
              Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
