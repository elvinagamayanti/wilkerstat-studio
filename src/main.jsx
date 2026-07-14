import { Component } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.jsx'

// ErrorBoundary sementara untuk debugging:
// kalau ada error runtime, pesan + stack trace tampil di halaman
// (bukan layar putih kosong). Boleh dihapus setelah masalah ketemu.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      const e = this.state.error
      return (
        <pre
          style={{
            padding: 24,
            margin: 0,
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
            fontSize: 13,
            color: '#B00020',
            background: '#FFF5F5',
            minHeight: '100vh',
          }}
        >
          {'TERJADI ERROR:\n\n' + String((e && e.stack) || e)}
        </pre>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)