import { useEffect, useMemo, useState } from 'react'
import { DESA, kecByIdkec, desaByIddesa, getSlsGroupsForDesa, KEC } from '../data'
import { MODE_LABEL, hashStr } from '../utils'
import { useToast } from './Toast'
import MapSheet from './MapSheet'

function DbRow({ name, meta, ready, onClick }) {
  return (
    <div className="db-item" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="db-thumb">{ready ? '🗺️' : '·'}</div>
      <div className="db-info">
        <div className="db-name">{name}</div>
        <div className="db-meta">{meta}</div>
      </div>
      <span className={`status-chip ${ready ? 'ready' : 'missing'}`}>
        {ready ? 'TERSEDIA' : 'BELUM ADA'}
      </span>
    </div>
  )
}

export default function TemplateView({ mode, active }) {
  const showToast = useToast()
  const label = MODE_LABEL[mode]

  const [idkec, setIdkec] = useState('')
  const [iddesa, setIddesa] = useState('')
  const [idsls, setIdsls] = useState('')
  const [idsubsls, setIdsubsls] = useState('')
  const [layout, setLayout] = useState(null)
  const [savedDb, setSavedDb] = useState(() => new Set())

  const kec = idkec ? kecByIdkec[idkec] : null
  const desa = iddesa ? desaByIddesa[iddesa] : null

  const kecOptions = useMemo(
    () =>
      KEC.features
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
  const slsGroup = idsls ? slsGroups.find((g) => g.idsls === idsls) : null
  const subOptions = useMemo(
    () =>
      slsGroup
        ? slsGroup.features
            .slice()
            .sort((a, b) => a.properties.kdsubsls.localeCompare(b.properties.kdsubsls))
        : [],
    [slsGroup],
  )
  const singleSub = slsGroup && slsGroup.features.length === 1 ? slsGroup.features[0] : null
  const subsls =
    singleSub ||
    (idsubsls && slsGroup
      ? slsGroup.features.find((f) => f.properties.idsubsls === idsubsls)
      : null)

  // ganti mode WA/WS/WSS → reset seleksi desa ke bawah, pertahankan kecamatan
  useEffect(() => {
    setIddesa('')
    setIdsls('')
    setIdsubsls('')
    setLayout(null)
  }, [mode])

  const canGenerate =
    (mode === 'WA' && !!desa) ||
    (mode === 'WS' && !!slsGroup) ||
    (mode === 'WSS' && !!subsls)

  const generate = (ctx) => {
    setLayout({ mode, ...ctx })
    showToast(`Peta ${mode} — ${ctx.desa.properties.nmdesa} berhasil digenerate`)
  }

  const onGenerate = () => {
    if (mode === 'WA' && desa) generate({ kec, desa })
    if (mode === 'WS' && slsGroup) generate({ kec, desa, group: slsGroup })
    if (mode === 'WSS' && subsls) generate({ kec, desa, group: slsGroup, subsls })
  }

  const onSaveDb = () => {
    let key, lbl
    if (mode === 'WA' && desa) {
      key = `WA:${desa.properties.iddesa}`
      lbl = desa.properties.nmdesa
    } else if (mode === 'WS' && slsGroup) {
      key = `WS:${slsGroup.idsls}`
      lbl = slsGroup.nmsls
    } else if (mode === 'WSS' && subsls) {
      key = `WSS:${slsGroup.idsls}`
      lbl = slsGroup.nmsls + ' - ' + subsls.properties.kdsubsls
    } else return
    setSavedDb((prev) => new Set(prev).add(key))
    showToast(`Peta ${mode} — ${lbl} disimpan ke basis data`)
  }

  const isReady = (key) => savedDb.has(key) || hashStr(key) % 10 < 6

  // ---- daftar basis data ----
  let dbRows = null
  if (mode === 'WA' && kec) {
    dbRows = desaOptions.map((f) => {
      const key = `WA:${f.properties.iddesa}`
      const ready = isReady(key)
      return (
        <DbRow
          key={key}
          name={f.properties.nmdesa}
          meta={f.properties.iddesa}
          ready={ready}
          onClick={() => {
            setIddesa(f.properties.iddesa)
            setIdsls('')
            setIdsubsls('')
            generate({ kec, desa: f })
            showToast(
              ready
                ? `Memuat peta tersimpan — ${f.properties.nmdesa}`
                : `Membuat peta baru untuk ${f.properties.nmdesa}…`,
            )
          }}
        />
      )
    })
  } else if (mode !== 'WA' && desa) {
    dbRows = slsGroups.map((g) => {
      const key = `${mode}:${g.idsls}`
      const ready = isReady(key)
      const meta = g.features.length > 1 ? `${g.idsls} · ${g.features.length} sub-SLS` : g.idsls
      return (
        <DbRow
          key={key}
          name={g.nmsls}
          meta={meta}
          ready={ready}
          onClick={() => {
            setIdsls(g.idsls)
            if (mode === 'WS') {
              generate({ kec, desa, group: g })
            } else {
              const sub = g.features[0]
              setIdsubsls(sub.properties.idsubsls)
              generate({ kec, desa, group: g, subsls: sub })
            }
            showToast(
              ready ? `Memuat peta tersimpan — ${g.nmsls}` : `Membuat peta baru untuk ${g.nmsls}…`,
            )
          }}
        />
      )
    })
  }

  return (
    <div className={`view${active ? ' active' : ''}`}>
      <div className="config-col">
        <h2 className="section-head">{label.full}</h2>
        <p className="section-desc">{label.desc}</p>

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
                setIdsubsls('')
                setLayout(null)
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
                setIdsubsls('')
              }}
            >
              <option value="">{kec ? '— pilih desa/kelurahan —' : '— pilih kecamatan dahulu —'}</option>
              {desaOptions.map((f) => (
                <option key={f.properties.iddesa} value={f.properties.iddesa}>
                  {f.properties.nmdesa}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(mode === 'WS' || mode === 'WSS') && (
          <div className="field">
            <label>SLS (RT / RW / Dusun)</label>
            <div className="select-wrap">
              <select
                className="sel"
                disabled={!desa}
                value={idsls}
                onChange={(e) => {
                  setIdsls(e.target.value)
                  setIdsubsls('')
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
        )}

        {mode === 'WSS' && (
          <div className="field">
            <label>Sub-SLS</label>
            <div className="select-wrap">
              <select
                className="sel"
                disabled={!slsGroup || !!singleSub}
                value={singleSub ? singleSub.properties.idsubsls : idsubsls}
                onChange={(e) => setIdsubsls(e.target.value)}
              >
                {singleSub ? (
                  <option value={singleSub.properties.idsubsls}>
                    Sub-SLS {singleSub.properties.kdsubsls}
                  </option>
                ) : (
                  <>
                    <option value="">
                      {slsGroup ? '— pilih sub-SLS —' : '— pilih SLS dahulu —'}
                    </option>
                    {subOptions.map((f) => (
                      <option key={f.properties.idsubsls} value={f.properties.idsubsls}>
                        Sub-SLS {f.properties.kdsubsls}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>
        )}

        {mode === 'WSS' && slsGroup && (
          <div className="hint-box">
            {singleSub ? (
              <>
                <b>SLS ini tidak terbagi sub-SLS.</b> Peta WSS akan identik dengan peta WS untuk
                SLS ini.
              </>
            ) : (
              <>
                SLS ini terbagi menjadi <b>{slsGroup.features.length} sub-SLS</b>. Pilih salah
                satu untuk memperjelas wilayah tugasnya.
              </>
            )}
          </div>
        )}

        <button className="btn btn-primary" disabled={!canGenerate} onClick={onGenerate}>
          Generate Peta
        </button>

        <div className="divider-line"></div>
        <h2 className="section-head" style={{ fontSize: 13 }}>
          Basis Data Peta Tersimpan
        </h2>
        <p className="section-desc" style={{ marginBottom: 12 }}>
          {label.dbDesc}
        </p>
        <div className="db-list">{dbRows}</div>
      </div>

      <div className="preview-col">
        {!layout && (
          <div className="empty-state">
            <div className="glyph">🗺️</div>
            <h3>Belum ada peta dipilih</h3>
            <p>
              Lengkapi pilihan wilayah di panel kiri, lalu klik <b>Generate Peta</b> untuk menyusun
              layout sesuai template pusat.
            </p>
          </div>
        )}

        {layout && (
          <div>
            <MapSheet layout={layout} />
            <div className="export-bar show">
              <button
                className="btn btn-primary"
                style={{ width: 'auto', flex: 1 }}
                onClick={() => showToast('Mengekspor PNG sesuai template pusat… (simulasi prototipe)')}
              >
                ⭳ Unduh PNG
              </button>
              <button
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={() => showToast('Mengekspor PDF layout cetak… (simulasi prototipe)')}
              >
                ⭳ Unduh PDF
              </button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onSaveDb}>
                💾 Simpan ke Basis Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
