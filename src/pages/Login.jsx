import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import '../styles/login.css'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)

    // TODO Session 2 : remplacer par supabase.auth.signInWithPassword
    // import { supabase } from '../lib/supabase'
    // const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setTimeout(() => {
      setLoading(false)
      setInfo('Auth Supabase pas encore branchée. Sera fait en Session 2 dès que les clés Supabase sont prêtes.')
      // Demo : permet d'accéder au dashboard quand même
      setTimeout(() => navigate('/dashboard'), 1200)
    }, 700)
  }

  return (
    <div className="login-page">
      <a href="../site/index.html" className="login-back-site">← Retour au site</a>
      <div className="login-bg" aria-hidden="true" />

      <div className="login-card">
        <div className="login-logo-wrap">
          <Link to="/login" className="login-logo">
            <img src="/logo.png" alt="Loops & Play" />
            <span>Loops <em>//</em> Play</span>
          </Link>
        </div>

        <header className="login-header">
          <p className="login-eyebrow">Espace adhérent</p>
          <h1 className="login-title">Bon retour parmi nous.</h1>
          <p className="login-subtitle">Connecte-toi avec les identifiants reçus par mail.</p>
        </header>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="login-error">{error}</p>}
          {info && <p className="login-info">{info}</p>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>

          <a
            href="https://wa.me/33759541545?text=Bonjour%20!%20J%27ai%20oubli%C3%A9%20mon%20mot%20de%20passe%20espace%20adh%C3%A9rent."
            target="_blank"
            rel="noopener noreferrer"
            className="login-forgot"
          >
            Mot de passe oublié ?
          </a>
        </form>

        <footer className="login-footer">
          <p>
            Pas encore adhérent ?{' '}
            <a href="https://wa.me/33759541545" target="_blank" rel="noopener noreferrer">
              Réserve un appel découverte
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}
