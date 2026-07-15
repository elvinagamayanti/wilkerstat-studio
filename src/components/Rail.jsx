import { stats } from '../data'

const MODES = [
  { key: 'WA', icon: 'WA', title: 'Wilayah Administrasi', sub: 'Batas desa + seluruh SLS' },
  { key: 'WS', icon: 'WS', title: 'Wilayah SLS', sub: 'Rincian per SLS' },
  { key: 'WSS', icon: 'WSS', title: 'Wilayah Sub-SLS', sub: 'Rincian per sub-SLS' },
  { key: 'INSET', icon: '⌖', title: 'WS-Inset', sub: 'Peta acuan tambahan' },
]

export default function Rail({ mode, onModeChange }) {
  return (
    <div className="rail">
      <div className="rail-label">Jenis Peta</div>
      {MODES.map((m) => (
        <button
          key={m.key}
          className={`mode-btn${mode === m.key ? ' active' : ''}`}
          onClick={() => onModeChange(m.key)}
        >
          <div className="mode-icon">{m.icon}</div>
          <div className="mode-text">
            <div className="mode-title">{m.title}</div>
            <div className="mode-sub">{m.sub}</div>
          </div>
        </button>
      ))}

      <div className="rail-divider"></div>
      <div className="rail-label">Cakupan Data Contoh</div>
      <div className="rail-stats">
        <div className="rail-stat-row">
          <span className="k">Kecamatan</span>
          <span className="v">{stats.kec}</span>
        </div>
        <div className="rail-stat-row">
          <span className="k">Desa/Kel.</span>
          <span className="v">{stats.desa}</span>
        </div>
        <div className="rail-stat-row">
          <span className="k">SLS</span>
          <span className="v">{stats.sls}</span>
        </div>
      </div>
      <div className="rail-divider"></div>
      <div className="rail-note">
        Data batas: Kab. Barru, Sulawesi Selatan (contoh). Skema seleksi wilayah sama untuk
        seluruh Indonesia.
      </div>
    </div>
  )
}
