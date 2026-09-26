import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './lib/auth'
import './styles/global.css'
import './styles/formations.css'
import './styles/admin.css'

// Capture tot de la proposition d'installation (Chrome, Android) :
// l'evenement part au chargement, avant que la page qui l'affiche existe.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__lpInstallation = e
  window.dispatchEvent(new Event('lp-installable'))
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/backstage">
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

// Appli installable : le service worker n'est enregistre qu'en production,
// pour ne pas melanger ses caches avec le serveur de developpement.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch((e) => console.warn('[sw]', e.message))
  })
}
