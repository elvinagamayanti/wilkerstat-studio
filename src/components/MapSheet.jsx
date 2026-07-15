import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { KEC, DESA, SLS } from '../data'
import { ESRI_SAT, MODE_LABEL, hashStr, niceScale, fmtDist } from '../utils'
import bpsLogo from '../assets/bps-logo.png'

function areaLabelHtml(feat) {
  return `<div class="area-label-in">${feat.properties.nmsls}<br>[${feat.properties.kdsubsls}]</div>`
}

function Legend({ mode }) {
  const adminRows = (
    <>
      <div className="legend-row"><span className="legend-line dashed"></span>Batas Provinsi *)</div>
      <div className="legend-row"><span className="legend-line dashed"></span>Batas Kabupaten/Kota *)</div>
      <div className="legend-row"><span className="legend-line thick"></span>Batas Kecamatan *)</div>
      <div className="legend-row">
        <span className="legend-line thin" style={{ borderColor: '#D5241E' }}></span>Batas Desa Kelurahan*)
      </div>
    </>
  )
  if (mode === 'WA' || mode === 'WSS') {
    return (
      <>
        {adminRows}
        <div className="legend-row"><span className="legend-line dashed thin"></span>Batas SLS/Sub SLS *)</div>
      </>
    )
  }
  return (
    <>
      {adminRows}
      <div className="legend-row"><span className="legend-line dashed thin"></span>Batas Satuan Lingkungan Setempat*)</div>
      <div className="legend-row"><span className="legend-line green"></span>Batas Blok Sensus</div>
      <div className="legend-row"><span className="legend-dot"></span>Titik Bangunan</div>
      <div className="legend-row"><span className="legend-tri"></span>Landmark Batas SLS</div>
    </>
  )
}

function Note({ mode }) {
  if (mode === 'WA' || mode === 'WSS') {
    return (
      <>
        *) Batas indikatif untuk kepentingan sensus dan survei BPS'
        <br />
        <br />
        <b>SUMBER:</b>
        <br />1. Peta Wilayah Kerja Statistik 2025-1 (BPS)
        <br />2. Google Hybrid/Google Maps/ESRI Maps/Bing Maps
      </>
    )
  }
  return (
    <>
      *) Batas indikatif untuk kepentingan sensus dan survei Badan Pusat Statistik (BPS)
      <br />
      <br />
      <b>Sumber:</b>
      <br />1. Peta Wilkerstat (Badan Pusat Statistik)
      <br />2. Google Hybrid/Google Roads/OpenStreetMaps/Bing Maps
    </>
  )
}

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

function ScaleBar({ scale }) {
  if (!scale) return null
  if (scale.type === 'simple') {
    const { barPx, dist } = scale
    return (
      <>
        <div className="scalebar-simple" style={{ width: barPx }}>
          <div className="line"></div>
          <div className="tick" style={{ left: 0 }}></div>
          <div className="tick" style={{ left: '50%' }}></div>
          <div className="tick" style={{ left: '100%' }}></div>
        </div>
        <div className="scale-simple-labels" style={{ width: barPx }}>
          <span>0</span>
          <span>{fmtDist(dist / 2)}</span>
          <span>{fmtDist(dist)}</span>
        </div>
      </>
    )
  }
  const { segPx, segs, dist } = scale
  const labels = []
  for (let i = 0; i <= segs; i += 2) labels.push(<span key={i}>{Math.round((dist / segs) * i)}</span>)
  return (
    <>
      <div className="scalebar-checker" style={{ width: segPx * segs }}>
        {Array.from({ length: segs }).map((_, i) => (
          <div key={i} style={{ width: segPx }}></div>
        ))}
      </div>
      <div className="scale-ticklabels" style={{ width: segPx * segs }}>{labels}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-soft)', marginTop: 1 }}>
        meter
      </div>
    </>
  )
}

export default function MapSheet({ layout }) {
  const mainMapRef = useRef(null)
  const locatorRef = useRef(null)
  const [coords, setCoords] = useState(null)
  const [scale, setScale] = useState(null)
  const [ratio, setRatio] = useState('')

  const { mode, kec, desa, group, subsls } = layout
  const dp = desa.properties
  const color = MODE_LABEL[mode].color

  let title, pill, seed
  if (mode === 'WA') {
    title = 'PETA WA : ' + dp.nmdesa
    pill = <span>{dp.iddesa}</span>
    seed = dp.iddesa
  } else if (mode === 'WS') {
    title = 'PETA WS : ' + group.nmsls
    pill = (
      <>
        <span>{group.idsls}</span>
        <span className="blank-box"></span>
        <span className="blank-box"></span>
      </>
    )
    seed = group.idsls
  } else {
    title = 'PETA WSS : ' + group.nmsls + ' - ' + subsls.properties.kdsubsls
    pill = <span>{subsls.properties.idsubsls}</span>
    seed = subsls.properties.idsubsls
  }

  // geometri fokus + deteksi orientasi lembar (landscape/portrait)
  // berdasarkan proporsi bounding box wilayah terpilih
  const fitGeo =
    mode === 'WA'
      ? desa
      : mode === 'WS'
        ? { type: 'FeatureCollection', features: group.features }
        : subsls
  const fb = L.geoJSON(fitGeo).getBounds()
  const midLat = (fb.getNorth() + fb.getSouth()) / 2
  const spanY = fb.getNorth() - fb.getSouth()
  const spanX = (fb.getEast() - fb.getWest()) * Math.cos((midLat * Math.PI) / 180)
  const orientation = spanX >= spanY ? 'landscape' : 'portrait'

  // ---- peta utama ----
  useEffect(() => {
    const map = L.map(mainMapRef.current, { attributionControl: false, preferCanvas: true })
    L.tileLayer(ESRI_SAT, { maxZoom: 19, crossOrigin: 'anonymous' }).addTo(map)

    // pane khusus halo: di bawah garis batas, diberi blur agar lembut
    map.createPane('halo')
    const haloPane = map.getPane('halo')
    haloPane.style.zIndex = 350
    haloPane.style.filter = 'blur(4px)'
    haloPane.style.pointerEvents = 'none'

    // PENTING: set view DULU sebelum layer vektor ditambahkan
    // (renderer canvas Leaflet error kalau layer masuk sebelum ada view).
    // Padding kecil agar wilayah terpilih tampil zoom rapat memenuhi frame.
    const padPx = mode === 'WA' ? [12, 12] : [30, 30]
    map.fitBounds(L.geoJSON(fitGeo).getBounds(), { padding: padPx, maxZoom: 19 })

    // gaya garis sesuai legenda template pusat
    const RED = '#D5241E'
    // Batas Desa/Kelurahan: merah solid
    const STYLE_DESA = { color: RED, weight: 2, fillOpacity: 0 }
    // Batas SLS/Sub-SLS (tetangga): merah putus-putus tipis
    const STYLE_SLS = { color: RED, weight: 1.1, dashArray: '7,5', fillOpacity: 0 }
    // Wilayah terpilih: merah putus-putus lebih tebal, tanpa fill (jernih)
    const STYLE_SELECTED = { color: RED, weight: 2.2, dashArray: '10,7', fillOpacity: 0 }

    // lapisan mask putih: semua area DI LUAR wilayah terpilih
    const addMask = (features) => {
      const world = [
        [-180, -90],
        [180, -90],
        [180, 90],
        [-180, 90],
        [-180, -90],
      ]
      const holes = []
      features.forEach((f) => {
        const g = f.geometry || f
        if (!g) return
        if (g.type === 'Polygon') {
          holes.push(g.coordinates[0])
        } else if (g.type === 'MultiPolygon') {
          g.coordinates.forEach((poly) => holes.push(poly[0]))
        }
      })
      if (!holes.length) return
      L.geoJSON(
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [world, ...holes] } },
        {
          style: { stroke: false, fillColor: '#ffffff', fillOpacity: 0.22 },
          interactive: false,
        },
      ).addTo(map)
    }

    // halo putih lembut di bawah garis batas (dirender di pane ber-blur)
    const addHalo = (geo, weight) => {
      L.geoJSON(geo, {
        pane: 'halo',
        style: { color: '#ffffff', weight, opacity: 0.8, fillOpacity: 0 },
        interactive: false,
      }).addTo(map)
    }

    const allSubsls = SLS.features.filter((f) => f.properties.iddesa === dp.iddesa)

    const addAreaLabel = (f) => {
      try {
        const c = L.geoJSON(f).getBounds().getCenter()
        L.marker(c, {
          icon: L.divIcon({ className: 'area-label', html: areaLabelHtml(f), iconSize: null }),
          interactive: false,
        }).addTo(map)
      } catch {
        /* abaikan geometri tak valid */
      }
    }

    if (mode === 'WA') {
      // mask luar desa
      addMask([desa])
      // selubung tipis menutupi seluruh peta — di template WA
      // area terpilih pun tidak 100% jernih
      L.rectangle(
        [
          [-89.9, -179.9],
          [89.9, 179.9],
        ],
        { stroke: false, fillColor: '#ffffff', fillOpacity: 0.08, interactive: false },
      ).addTo(map)
      // glow hanya untuk batas antar-SLS di dalam desa (batas luar polos)
      allSubsls.forEach((f) => addHalo(f, 4))
      allSubsls.forEach((f) => {
        L.geoJSON(f, { style: STYLE_SLS }).addTo(map)
        addAreaLabel(f)
      })
      L.geoJSON(desa, { style: STYLE_DESA }).addTo(map)
    } else if (mode === 'WS') {
      // jernih: seluruh SLS terpilih (semua sub-nya)
      addMask(group.features)
      allSubsls.forEach((f) => {
        if (f.properties.idsls === group.idsls) return
        L.geoJSON(f, { style: STYLE_SLS }).addTo(map)
        addAreaLabel(f)
      })
      L.geoJSON(desa, { style: STYLE_DESA }).addTo(map)
      L.geoJSON(
        { type: 'FeatureCollection', features: group.features },
        { style: STYLE_SELECTED },
      ).addTo(map)
    } else {
      // jernih: hanya sub-SLS terpilih
      addMask([subsls])
      allSubsls.forEach((f) => {
        if (f.properties.idsubsls === subsls.properties.idsubsls) return
        L.geoJSON(f, { style: STYLE_SLS }).addTo(map)
        addAreaLabel(f)
      })
      L.geoJSON(desa, { style: STYLE_DESA }).addTo(map)
      L.geoJSON(subsls, { style: STYLE_SELECTED }).addTo(map)
    }

    const tm = setTimeout(() => {
      map.invalidateSize()
      // fit ulang setelah ukuran frame (potret/landscape) final
      map.fitBounds(L.geoJSON(fitGeo).getBounds(), { padding: padPx, maxZoom: 19 })
      const b = map.getBounds()
      setCoords({
        n: b.getNorth().toFixed(6),
        s: b.getSouth().toFixed(6),
        w: b.getWest().toFixed(6),
        e: b.getEast().toFixed(6),
      })
      // hitung skala
      const size = map.getSize()
      const zoom = map.getZoom()
      const center = map.getCenter()
      const mpp = (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / Math.pow(2, zoom)
      setRatio('1:' + Math.max(1, Math.round(mpp / 0.0002646)))
      if (mode === 'WA') {
        const dist = niceScale(mpp * size.x * 0.32)
        setScale({ type: 'simple', dist, barPx: dist / mpp })
      } else {
        const segs = 8
        const dist = niceScale(mpp * 150)
        setScale({ type: 'checker', segs, dist, segPx: dist / mpp / segs })
      }
    }, 150)

    return () => {
      clearTimeout(tm)
      map.remove()
    }
  }, [layout]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- peta lokator ----
  useEffect(() => {
    const map = L.map(locatorRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      boxZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
    })
    // gaya template: latar putih, poligon bergaris tipis, wilayah terpilih merah
    const BASE = { color: '#9aa4ad', weight: 0.7, fillColor: '#ffffff', fillOpacity: 1 }
    const SEL = { color: '#D5241E', weight: 1, fillColor: '#D5241E', fillOpacity: 1 }
    const OUTLINE = { color: '#8B2E2E', weight: 1.2, fillOpacity: 0 }
    if (mode === 'WA') {
      // konteks: semua desa dalam kecamatan; terpilih: desa
      const desas = DESA.features.filter((f) => f.properties.kdkec === kec.properties.kdkec)
      L.geoJSON({ type: 'FeatureCollection', features: desas }, { style: () => BASE }).addTo(map)
      L.geoJSON(desa, { style: () => SEL }).addTo(map)
      L.geoJSON(kec, { style: () => OUTLINE }).addTo(map)
      map.fitBounds(L.geoJSON(kec).getBounds(), { padding: [3, 3] })
    } else {
      // konteks: semua SLS dalam desa; terpilih: SLS (WS) / sub-SLS (WSS)
      const feats = SLS.features.filter((f) => f.properties.iddesa === dp.iddesa)
      L.geoJSON({ type: 'FeatureCollection', features: feats }, { style: () => BASE }).addTo(map)
      const sel = mode === 'WS' ? group.features : [subsls]
      L.geoJSON({ type: 'FeatureCollection', features: sel }, { style: () => SEL }).addTo(map)
      L.geoJSON(desa, { style: () => OUTLINE }).addTo(map)
      map.fitBounds(L.geoJSON(desa).getBounds(), { padding: [3, 3] })
    }
    const tm = setTimeout(() => map.invalidateSize(), 200)
    return () => {
      clearTimeout(tm)
      map.remove()
    }
  }, [layout]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="sheet-wrap show">
      <div className={`sheet ${orientation}`}>
        <div className="sheet-topline">
          <h1 className="sheet-title">{title}</h1>
          <div className={`id-pill${mode === 'WA' ? ' dark' : ''}`}>{pill}</div>
        </div>
        <div className="sheet-grid">
          <div className="map-frame">
            <div ref={mainMapRef} style={{ width: '100%', height: '100%' }}></div>
            <div className="coord-label coord-tl">{coords && 'Y: ' + coords.n}</div>
            <div className="coord-label coord-tr">{coords && 'Y: ' + coords.n}</div>
            <div className="coord-label coord-bl">{coords && 'Y: ' + coords.s}</div>
            <div className="coord-label coord-br">{coords && 'Y: ' + coords.s}</div>
            <div className="coord-label coord-left">{coords && 'X: ' + coords.w}</div>
            <div className="coord-label coord-right">{coords && 'X: ' + coords.e}</div>
          </div>
          <div className="sidebar-info">
            <div className="info-block b-id">
              <h5>Provinsi :</h5>
              <div className="val">[{dp.kdprov}] {kec.properties.nmprov}</div>
              <h5>Kabupaten/Kota :</h5>
              <div className="val">[{dp.kdkab}] {kec.properties.nmkab}</div>
              <h5>Kecamatan :</h5>
              <div className="val">[{dp.kdkec}] {kec.properties.nmkec}</div>
              <h5>Desa/Kelurahan :</h5>
              <div className="val">[{dp.kddesa}] {dp.nmdesa}</div>
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
                  <div>
                    <ScaleBar scale={scale} />
                  </div>
                </div>
              </div>
            </div>
            <div className="info-block b-legend">
              <h5 className="legend-head">LEGENDA</h5>
              <div className="legend-sub">Batas Wilayah Kerja Statistik</div>
              <div>
                <Legend mode={mode} />
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
              {mode !== 'WA' && (
                <div className="form-field-row">
                  <span className="flabel">Nama Petugas</span>
                  <div className="fline"></div>
                </div>
              )}
            </div>
            <div className="info-block b-loc">
              <div className="locator-qr-row">
                <div className="locator-box">
                  <span className="cap">Lokasi Peta</span>
                  <div ref={locatorRef} id="locatorMap"></div>
                </div>
                {mode !== 'WA' && (
                  <div className="qr-box">
                    <span className="cap">QR-LOC</span>
                    <QrGrid seed={seed} />
                  </div>
                )}
              </div>
            </div>
            <div className="info-block b-logo">
              <div className="sheet-logo">
                <img src={bpsLogo} alt="BPS" />
              </div>
            </div>
            <div className="info-block b-note">
              <div className="note-box">
                <Note mode={mode} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}