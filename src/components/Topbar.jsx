import { useEffect, useState } from 'react'
import { nowStr } from '../utils'
import bpsLogo from '../assets/bps-logo.png'

export default function Topbar({ railOpen, onToggleRail }) {
  const [clock, setClock] = useState(nowStr())

  useEffect(() => {
    const id = setInterval(() => setClock(nowStr()), 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="topbar">
      <button
        className="icon-btn"
        onClick={onToggleRail}
        title={railOpen ? 'Tutup panel jenis peta' : 'Buka panel jenis peta'}
        aria-label={railOpen ? 'Tutup sidebar' : 'Buka sidebar'}
        aria-expanded={railOpen}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <div className="brandmark">
        <img src={bpsLogo} alt="BPS" />
        <div className="brand-text">
          Wilkerstat Studio
          <span>BPS Kabupaten Barru · Generator Peta Wilayah Kerja</span>
        </div>
      </div>
      <span className="proto-badge">● PROTOTIPE FRONTEND</span>
      <div className="topbar-spacer"></div>
      <div className="topbar-meta">
        <span>
          <span className="dot"></span>Template pusat termuat
        </span>
        <span>
          <b>{clock}</b> WITA
        </span>
      </div>
    </div>
  )
}