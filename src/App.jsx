import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import AuthRedirect from './pages/AuthRedirect.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Formations from './pages/Formations.jsx'
import Packs from './pages/Packs.jsx'
import Profil from './pages/Profil.jsx'
import Admin from './pages/Admin.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth-redirect" element={<AuthRedirect />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/formations" element={<Formations />} />
      <Route path="/packs" element={<Packs />} />
      <Route path="/profil" element={<Profil />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
