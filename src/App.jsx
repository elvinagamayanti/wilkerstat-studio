import { useState } from 'react'
import Topbar from './components/Topbar'
import Rail from './components/Rail'
import TemplateView from './components/TemplateView'
import InsetView from './components/InsetView'
import { ToastProvider } from './components/Toast'

export default function App() {
  const [mode, setMode] = useState('WA')
  // mode template terakhir (WA/WS/WSS) agar peta inset tetap ter-mount saat berpindah
  const templateMode = mode === 'INSET' ? null : mode
  const [lastTemplateMode, setLastTemplateMode] = useState('WA')

  const handleModeChange = (m) => {
    setMode(m)
    if (m !== 'INSET') setLastTemplateMode(m)
  }

  return (
    <ToastProvider>
      <div id="app">
        <Topbar />
        <div className="shell">
          <Rail mode={mode} onModeChange={handleModeChange} />
          <div className="main">
            <TemplateView
              mode={templateMode || lastTemplateMode}
              active={mode !== 'INSET'}
            />
            <InsetView active={mode === 'INSET'} />
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}
