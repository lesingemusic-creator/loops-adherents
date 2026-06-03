import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AppLayout from './components/AppLayout.jsx'
import Login from './pages/Login.jsx'
import AuthRedirect from './pages/AuthRedirect.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Formations from './pages/Formations.jsx'
import Packs from './pages/Packs.jsx'
import Profil from './pages/Profil.jsx'
import Admin from './pages/Admin.jsx'

// Helper qui combine route protégée + layout
function Private({ children }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth-redirect" element={<AuthRedirect />} />

      {/* Privé (auth requise + layout commun) */}
      <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
      <Route path="/formations" element={<Private><Formations /></Private>} />
      <Route path="/packs" element={<Private><Packs /></Private>} />
      <Route path="/profil" element={<Private><Profil /></Private>} />
      <Route path="/admin" element={<Private><Admin /></Private>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
