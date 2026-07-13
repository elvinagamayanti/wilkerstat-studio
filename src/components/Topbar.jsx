import { useEffect, useState } from 'react'
import { nowStr } from '../utils'
import bpsLogo from '../assets/bps-logo.png'

export default function Topbar() {
  const [clock, setClock] = useState(nowStr())

  useEffect(() => {
    const id = setInterval(() => setClock(nowStr()), 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="topbar">
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
