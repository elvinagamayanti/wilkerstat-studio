import { useState } from 'react'
import Topbar from './components/Topbar'
import Rail from './components/Rail'
import TemplateView from './components/TemplateView'
import InsetView from './components/InsetView'
import { ToastProvider } from './components/Toast'

const MOBILE_BP = 900

export default function App() {
  const [mode, setMode] = useState('WA')
  // mode template terakhir (WA/WS/WSS) agar peta inset tetap ter-mount saat berpindah
  const templateMode = mode === 'INSET' ? null : mode
  const [lastTemplateMode, setLastTemplateMode] = useState('WA')

  // sidebar jenis peta: terbuka default di layar lebar, tertutup di layar kecil
  const [railOpen, setRailOpen] = useState(() => window.innerWidth > MOBILE_BP)
  // panel pemilihan wilayah (config): bisa disembunyikan agar peta full page
  const [panelOpen, setPanelOpen] = useState(true)

  const pokeLeafletResize = () => {
    // picu resize setelah transisi CSS selesai agar peta Leaflet menyesuaikan ukuran baru
    setTimeout(() => window.dispatchEvent(new Event('resize')), 260)
  }

  const toggleRail = () => {
    setRailOpen((o) => !o)
    pokeLeafletResize()
  }

  const closeRail = () => {
    setRailOpen(false)
    pokeLeafletResize()
  }

  const togglePanel = () => {
    setPanelOpen((o) => !o)
    pokeLeafletResize()
  }

  const handleModeChange = (m) => {
    setMode(m)
    if (m !== 'INSET') setLastTemplateMode(m)
    // di layar kecil, tutup drawer setelah memilih mode
    if (window.innerWidth <= MOBILE_BP) closeRail()
  }

  return (
    <ToastProvider>
      <div id="app">
        <Topbar railOpen={railOpen} onToggleRail={toggleRail} />
        <div className={`shell${railOpen ? '' : ' rail-closed'}`}>
          <div className="rail-col">
            <Rail mode={mode} onModeChange={handleModeChange} />
          </div>
          {railOpen && <div className="rail-backdrop" onClick={closeRail}></div>}
          <div className={`main${panelOpen ? '' : ' panel-hidden'}`}>
            <TemplateView
              mode={templateMode || lastTemplateMode}
              active={mode !== 'INSET'}
            />
            <InsetView active={mode === 'INSET'} />

            <button
              className="panel-toggle"
              onClick={togglePanel}
              title={panelOpen ? 'Sembunyikan panel wilayah' : 'Tampilkan panel wilayah'}
              aria-label={panelOpen ? 'Sembunyikan panel wilayah' : 'Tampilkan panel wilayah'}
              aria-expanded={panelOpen}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                {panelOpen ? (
                  <polyline points="15 18 9 12 15 6" />
                ) : (
                  <polyline points="9 18 15 12 9 6" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}