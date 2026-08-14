import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'

// Gewaehlte Farbpalette der App (siehe index.css). Wie in den Entwuerfen als
// Attribut am Wurzelelement, damit sich die Entscheidung an einer Stelle
// zuruecknehmen laesst.
document.documentElement.setAttribute('data-palette', 'setb')

// Dunkles Design ist die Voreinstellung; eine eigene Wahl im Profil hat
// Vorrang und wird hier wiederhergestellt.
const savedTheme = localStorage.getItem('myprosole_theme')
document.documentElement.setAttribute(
  'data-theme',
  savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark',
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}
