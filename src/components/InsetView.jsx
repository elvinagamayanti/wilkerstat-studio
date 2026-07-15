import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { DESA, SLS, kecByIdkec, desaByIddesa, getSlsGroupsForDesa } from '../data'
import { ESRI_SAT, OSM_STREET, nowStr, hashStr, niceScale } from '../utils'
import { useToast } from './Toast'
import bpsLogo from '../assets/bps-logo.png'

function QrGrid({ seed }) {
  const h = hashStr(seed)
  const cells = []
  for (let i = 0; i < 81; i++) {
    const on = ((h >> (i % 24)) ^ (i * 2654435761)) & 1
    const row = Math.floor(i / 9)
    const col = i % 9
    const isFinder = (row < 3 && col < 3) || (row < 3 && col > 5) || (row > 5 && col < 3)
    cells.push(<div key={i} className={isFinder || on ? 'on' : ''}></div>)
  }
  return <div className="qr-grid">{cells}</div>
}

export default function InsetView({ active }) {
  const showToast = useToast()

  const mapDivRef = useRef(null)
  const mapRef = useRef(null)
  const satRef = useRef(null)
  const streetRef = useRef(null)
  const boundaryRef = useRef(null)
  const templateViewRef = useRef(null)
  const locatorRef = useRef(null)
  const locMapRef = useRef(null)

  // seleksi berjenjang (sama polanya dengan TemplateView)
  const [idkec, setIdkec] = useState('')
  const [iddesa, setIddesa] = useState('')
  const [idsls, setIdsls] = useState('')

  const [boundaryOn, setBoundaryOn] = useState(true)
  const [basemap, setBasemap] = useState('sat')
  // orientasi template inset: 'landscape' | 'portrait'
  const [orientasi, setOrientasi] = useState('landscape')
  const [ratio, setRatio] = useState('')
  const [scale, setScale] = useState(null)
  const [savedInsets, setSavedInsets] = useState([])
  // nomor inset yang sedang ditampilkan; null = nomor berikutnya (belum disimpan)
  const [viewNo, setViewNo] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalName, setModalName] = useState('')

  const kec = idkec ? kecByIdkec[idkec] : null
  const desa = iddesa ? desaByIddesa[iddesa] : null

  const kecOptions = useMemo(
    () =>
      Object.values(kecByIdkec)
        .slice()
        .sort((a, b) => a.properties.nmkec.localeCompare(b.properties.nmkec)),
    [],
  )
  const desaOptions = useMemo(() => {
    if (!kec) return []
    return DESA.features
      .filter((f) => f.properties.kdkec === kec.properties.kdkec)
      .sort((a, b) => a.properties.nmdesa.localeCompare(b.properties.nmdesa))
  }, [kec])
  const slsGroups = useMemo(
    () => (desa ? getSlsGroupsForDesa(desa.properties.iddesa) : []),
    [desa],
  )
  const group = idsls ? slsGroups.find((g) => g.idsls === idsls) : null

  // nomor inset: yang sedang dibuka, atau nomor berikutnya untuk SLS ini
  const nextNo = savedInsets.filter((s) => s.idsls === idsls).length + 1
  const displayNo = viewNo ?? nextNo
  const insetLabel = 'INSET-' + String(displayNo).padStart(2, '0')

  // buat peta saat SLS pertama kali dipilih; muat ulang batas tiap ganti SLS
  useEffect(() => {
    if (!group) return
    if (!mapRef.current) {
      const map = L.map(mapDivRef.current, { zoomControl: false, attributionControl: false })
      const sat = L.tileLayer(ESRI_SAT, { maxZoom: 19 }).addTo(map)
      const street = L.tileLayer(OSM_STREET, { maxZoom: 19, subdomains: 'abc', opacity: 0 }).addTo(map)
      map.on('moveend zoomend', () => {
        const c = map.getCenter()
        const mpp =
          (156543.03392 * Math.cos((c.lat * Math.PI) / 180)) / Math.pow(2, map.getZoom())
        setRatio('1:' + Math.max(1, Math.round(mpp / 0.0002646)))
        const segs = 8
        const dist = niceScale(mpp * 150)
        setScale({ segs, dist, segPx: dist / mpp / segs })
      })
      mapRef.current = map
      satRef.current = sat
      streetRef.current = street
    }
    const map = mapRef.current
    if (boundaryRef.current) map.removeLayer(boundaryRef.current)

    // gaya identik dengan lembar WS/WSS
    const RED = '#D5241E'
    const lg = L.layerGroup()

    // mask putih transparan di luar SLS terpilih
    const world = [
      [-180, -90],
      [180, -90],
      [180, 90],
      [-180, 90],
      [-180, -90],
    ]
    const holes = []
    group.features.forEach((f) => {
      const g = f.geometry
      if (!g) return
      if (g.type === 'Polygon') holes.push(g.coordinates[0])
      else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => holes.push(p[0]))
    })
    if (holes.length) {
      lg.addLayer(
        L.geoJSON(
          { type: 'Feature', geometry: { type: 'Polygon', coordinates: [world, ...holes] } },
          { style: { stroke: false, fillColor: '#ffffff', fillOpacity: 0.22 }, interactive: false },
        ),
      )
    }

    // batas & label SLS tetangga dalam desa yang sama
    const allSubsls = SLS.features.filter((f) => f.properties.iddesa === desa.properties.iddesa)
    allSubsls.forEach((f) => {
      if (f.properties.idsls === group.idsls) return
      lg.addLayer(
        L.geoJSON(f, { style: { color: RED, weight: 1.1, dashArray: '7,5', fillOpacity: 0 } }),
      )
      try {
        const c = L.geoJSON(f).getBounds().getCenter()
        lg.addLayer(
          L.marker(c, {
            icon: L.divIcon({
              className: 'area-label',
              html: `<div class="area-label-in">${f.properties.nmsls}<br>[${f.properties.kdsubsls}]</div>`,
              iconSize: null,
            }),
            interactive: false,
          }),
        )
      } catch {
        /* abaikan geometri tak valid */
      }
    })

    // batas desa solid + SLS terpilih putus-putus tebal (jernih)
    lg.addLayer(L.geoJSON(desa, { style: { color: RED, weight: 2, fillOpacity: 0 } }))
    lg.addLayer(
      L.geoJSON(
        { type: 'FeatureCollection', features: group.features },
        { style: { color: RED, weight: 2.2, dashArray: '10,7', fillOpacity: 0 } },
      ),
    )

    boundaryRef.current = lg.addTo(map)
    setBoundaryOn(true)
    const gb = L.geoJSON({ type: 'FeatureCollection', features: group.features }).getBounds()
    map.fitBounds(gb, { padding: [40, 40], maxZoom: 18 })
    setTimeout(() => {
      map.invalidateSize()
      map.fitBounds(gb, { padding: [40, 40], maxZoom: 18 })
      templateViewRef.current = { center: map.getCenter(), zoom: map.getZoom() }
    }, 150)
  }, [group])

  // peta lokator kecil (Lokasi Peta) — dibuat ulang tiap ganti wilayah
  useEffect(() => {
    if (!group || !locatorRef.current) return
    if (locMapRef.current) {
      locMapRef.current.remove()
      locMapRef.current = null
    }
    const m = L.map(locatorRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      boxZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
    })
    const feats = SLS.features.filter((f) => f.properties.iddesa === desa.properties.iddesa)
    L.geoJSON(
      { type: 'FeatureCollection', features: feats },
      { style: () => ({ color: '#9aa4ad', weight: 0.7, fillColor: '#ffffff', fillOpacity: 1 }) },
    ).addTo(m)
    L.geoJSON(
      { type: 'FeatureCollection', features: group.features },
      { style: () => ({ color: '#D5241E', weight: 1, fillColor: '#D5241E', fillOpacity: 1 }) },
    ).addTo(m)
    L.geoJSON(desa, { style: () => ({ color: '#8B2E2E', weight: 1.2, fillOpacity: 0 }) }).addTo(m)
    m.fitBounds(L.geoJSON(desa).getBounds(), { padding: [3, 3] })
    const tm = setTimeout(() => m.invalidateSize(), 200)
    locMapRef.current = m
    return () => clearTimeout(tm)
  }, [group]) // eslint-disable-line react-hooks/exhaustive-deps

  // bersihkan peta saat komponen dilepas
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      if (locMapRef.current) {
        locMapRef.current.remove()
        locMapRef.current = null
      }
    }
  }, [])

  // invalidasi ukuran saat view aktif / orientasi berubah
  useEffect(() => {
    if (active && mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 60)
  }, [active])
  useEffect(() => {
    if (mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 60)
    if (locMapRef.current) setTimeout(() => locMapRef.current.invalidateSize(), 80)
  }, [orientasi])

  // toggle basemap
  useEffect(() => {
    if (!satRef.current || !streetRef.current) return
    satRef.current.setOpacity(basemap === 'sat' ? 1 : 0)
    streetRef.current.setOpacity(basemap === 'street' ? 1 : 0)
  }, [basemap])

  const toggleBoundary = () => {
    const map = mapRef.current
    if (!boundaryRef.current || !map) return
    if (map.hasLayer(boundaryRef.current)) {
      map.removeLayer(boundaryRef.current)
      setBoundaryOn(false)
    } else {
      boundaryRef.current.addTo(map)
      setBoundaryOn(true)
    }
  }

  const openSaveModal = () => {
    if (!group) return
    setModalName(`${group.nmsls} - ${insetLabel}`)
    setModalOpen(true)
  }

  const confirmSave = () => {
    const map = mapRef.current
    const name = modalName.trim() || `${group.nmsls} - ${insetLabel}`
    const item = {
      id: 'ins_' + Date.now(),
      no: nextNo,
      name,
      idkec,
      iddesa,
      idsls,
      nmsls: group.nmsls,
      center: map.getCenter(),
      zoom: map.getZoom(),
      basemap,
      orientasi,
      savedAt: nowStr(),
    }
    setSavedInsets((prev) => [...prev, item])
    setViewNo(item.no)
    setModalOpen(false)
    showToast(`${name} berhasil disimpan`)
  }

  const openSaved = (item) => {
    setIdkec(item.idkec)
    setIddesa(item.iddesa)
    setIdsls(item.idsls)
    setViewNo(item.no || 1)
    setOrientasi(item.orientasi || 'landscape')
    setBasemap(item.basemap)
    setTimeout(() => {
      if (mapRef.current) mapRef.current.setView(item.center, item.zoom)
    }, 250)
    showToast(`Membuka ${item.name}`)
  }

  const deleteSaved = (item) => {
    setSavedInsets((prev) => prev.filter((s) => s.id !== item.id))
    showToast(`${item.name} dihapus`)
  }

  // label sumbu skala berpetak
  const scaleLabels = []
  if (scale) {
    for (let i = 0; i <= scale.segs; i += 2) {
      scaleLabels.push(<span key={i}>{Math.round((scale.dist / scale.segs) * i)}</span>)
    }
  }

  return (
    <div className={`view inset-view${active ? ' active' : ''}`}>
      <div className="config-col">
        <h2 className="section-head">WS-Inset</h2>
        <p className="section-desc">
          Pilih wilayah untuk memuat peta acuan di dalam template. Geser dan perbesar peta sesuai
          kebutuhan, lalu simpan sebagai inset baru.
        </p>

        <div className="field">
          <label>Kecamatan</label>
          <div className="select-wrap">
            <select
              className="sel"
              value={idkec}
              onChange={(e) => {
                setIdkec(e.target.value)
                setIddesa('')
                setIdsls('')
                setViewNo(null)
              }}
            >
              <option value="">— pilih kecamatan —</option>
              {kecOptions.map((f) => (
                <option key={f.properties.idkec} value={f.properties.idkec}>
                  {f.properties.nmkec}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Desa / Kelurahan</label>
          <div className="select-wrap">
            <select
              className="sel"
              disabled={!kec}
              value={iddesa}
              onChange={(e) => {
                setIddesa(e.target.value)
                setIdsls('')
                setViewNo(null)
              }}
            >
              <option value="">
                {kec ? '— pilih desa/kelurahan —' : '— pilih kecamatan dahulu —'}
              </option>
              {desaOptions.map((f) => (
                <option key={f.properties.iddesa} value={f.properties.iddesa}>
                  {f.properties.nmdesa}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>SLS (RT / RW / Dusun)</label>
          <div className="select-wrap">
            <select
              className="sel"
              disabled={!desa}
              value={idsls}
              onChange={(e) => {
                setIdsls(e.target.value)
                setViewNo(null)
              }}
            >
              <option value="">{desa ? '— pilih SLS —' : '— pilih desa dahulu —'}</option>
              {slsGroups.map((g) => (
                <option key={g.idsls} value={g.idsls}>
                  {g.nmsls}
                </option>
              ))}
            </select>
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
                    {item.idsls} · zoom {item.zoom} ·{' '}
                    {item.orientasi === 'portrait' ? 'Potret' : 'Lanskap'}
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
        {group ? (
          <div>
            <div className={`sheet ${orientasi}`}>
              <div className="sheet-topline">
                <h1 className="sheet-title">
                  PETA WS : {group.nmsls} - {insetLabel}
                </h1>
                <div className="id-pill">
                  <span>{group.idsls}</span>
                  <span className="blank-box"></span>
                  <span className="blank-box"></span>
                </div>
              </div>
              <div className="sheet-grid">
                <div className="map-frame">
                  <div id="insetMap" ref={mapDivRef}></div>

                  <div className="map-toolbar" style={{ display: 'flex' }}>
                    <button className="tb-btn" title="Perbesar" onClick={() => mapRef.current.zoomIn()}>
                      ＋
                    </button>
                    <button className="tb-btn" title="Perkecil" onClick={() => mapRef.current.zoomOut()}>
                      －
                    </button>
                    <button
                      className="tb-btn"
                      title="Kembali ke tampilan acuan"
                      onClick={() => {
                        if (templateViewRef.current)
                          mapRef.current.setView(
                            templateViewRef.current.center,
                            templateViewRef.current.zoom,
                          )
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

                  <div className="map-basemap-toggle" style={{ display: 'flex', right: 165 }}>
                    <button
                      className={`bm-opt${orientasi === 'landscape' ? ' active' : ''}`}
                      onClick={() => setOrientasi('landscape')}
                    >
                      Lanskap
                    </button>
                    <button
                      className={`bm-opt${orientasi === 'portrait' ? ' active' : ''}`}
                      onClick={() => setOrientasi('portrait')}
                    >
                      Potret
                    </button>
                  </div>

                  <div className="save-bar" style={{ display: 'flex' }}>
                    <button className="btn btn-primary" onClick={openSaveModal}>
                      💾 Simpan sebagai WS-Inset
                    </button>
                  </div>
                </div>

                <div className="sidebar-info">
                  <div className="info-block b-id">
                    <h5>Provinsi :</h5>
                    <div className="val">[{desa.properties.kdprov}] {kec.properties.nmprov}</div>
                    <h5>Kabupaten/Kota :</h5>
                    <div className="val">[{desa.properties.kdkab}] {kec.properties.nmkab}</div>
                    <h5>Kecamatan :</h5>
                    <div className="val">[{desa.properties.kdkec}] {kec.properties.nmkec}</div>
                    <h5>Desa/Kelurahan :</h5>
                    <div className="val">[{desa.properties.kddesa}] {desa.properties.nmdesa}</div>
                  </div>

                  <div className="info-block b-scale">
                    <div className="compass-scale-row">
                      <div className="compass-wrap">
                        <svg viewBox="0 0 40 40">
                          <circle cx="20" cy="20" r="17" fill="#fff" stroke="#152029" strokeWidth="1.3" />
                          <polygon points="20,5 25,20 20,17 15,20" fill="#D5241E" />
                          <polygon points="20,35 25,20 20,23 15,20" fill="#152029" />
                        </svg>
                        <div className="lbl">U</div>
                      </div>
                      <div className="scale-wrap">
                        <div className="cap">
                          SKALA <span>{ratio}</span>
                        </div>
                        {scale && (
                          <div>
                            <div className="scalebar-checker" style={{ width: scale.segPx * scale.segs }}>
                              {Array.from({ length: scale.segs }).map((_, i) => (
                                <div key={i} style={{ width: scale.segPx }}></div>
                              ))}
                            </div>
                            <div
                              className="scale-ticklabels"
                              style={{ width: scale.segPx * scale.segs }}
                            >
                              {scaleLabels}
                            </div>
                            <div
                              style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 7,
                                color: 'var(--ink-soft)',
                                marginTop: 1,
                              }}
                            >
                              meter
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="info-block b-legend">
                    <h5 className="legend-head">LEGENDA</h5>
                    <div className="legend-sub">Batas Wilayah Kerja Statistik</div>
                    <div>
                      <div className="legend-row">
                        <span className="legend-line thin" style={{ borderColor: '#D5241E' }}></span>
                        Batas Desa Kelurahan*)
                      </div>
                      <div className="legend-row">
                        <span className="legend-line dashed thin"></span>Batas SLS/Sub SLS *)
                      </div>
                    </div>
                  </div>

                  <div className="info-block b-form">
                    <div className="form-field-row">
                      <span className="flabel">Nama Kegiatan</span>
                      <div className="fline"></div>
                    </div>
                    <div className="form-field-row">
                      <span className="flabel">Tahun/Periode</span>
                      <div className="fline"></div>
                    </div>
                    <div className="form-field-row">
                      <span className="flabel">Nama Petugas</span>
                      <div className="fline"></div>
                    </div>
                  </div>

                  <div className="info-block b-loc">
                    <div className="locator-qr-row">
                      <div className="locator-box">
                        <span className="cap">Lokasi Peta</span>
                        <div ref={locatorRef} id="locatorMap"></div>
                      </div>
                      <div className="qr-box">
                        <span className="cap">QR-LOC</span>
                        <QrGrid seed={group.idsls + '-' + displayNo} />
                      </div>
                    </div>
                  </div>

                  <div className="info-block b-logo">
                    <div className="sheet-logo">
                      <img src={bpsLogo} alt="BPS" />
                    </div>
                  </div>

                  <div className="info-block b-note">
                    <div className="note-box">
                      *) Batas indikatif untuk kepentingan sensus dan survei BPS'
                      <br />
                      <br />
                      <b>SUMBER:</b>
                      <br />1. Peta Wilayah Kerja Statistik 2025-1 (BPS)
                      <br />2. Google Hybrid/Google Maps/ESRI Maps/Bing Maps
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {viewNo != null && (
              <div className="export-bar show">
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => showToast(`Mengunduh ${insetLabel} sebagai PNG… (simulasi)`)}
                >
                  ⬇ Unduh PNG
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                  onClick={() => showToast(`Mengunduh ${insetLabel} sebagai PDF… (simulasi)`)}
                >
                  ⬇ Unduh PDF
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state" style={{ margin: 'auto' }}>
            <div className="glyph">⌖</div>
            <h3>Belum ada SLS dipilih</h3>
            <p>Pilih kecamatan, desa, dan SLS di panel kiri untuk memuat peta acuan.</p>
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
            Beri nama untuk peta inset ini. Tampilan (posisi &amp; zoom), basemap, dan orientasi
            saat ini akan disimpan bersama nama tersebut.
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