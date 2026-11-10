import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import '../styles/login.css'

export default function Login() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Si déjà connecté, redirige direct au dashboard
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, authLoading, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      setSubmitting(false)
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Email ou mot de passe incorrect.'
          : /banned/i.test(authError.message)
            ? "Ton accès au Backstage est terminé (il reste ouvert un mois après la fin de ta formation). Pour le prolonger, écris à Jérôme sur WhatsApp au 07 59 54 15 45."
            : 'Erreur : ' + authError.message
      )
      return
    }

    // Le AuthProvider va capter la session via onAuthStateChange.
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="login-page">
      <a href="https://loopsplay.com" className="login-back-site">← Retour au site</a>
      <div className="login-bg" aria-hidden="true" />

      <div className="login-card">
        <div className="login-logo-wrap">
          <Link to="/login" className="login-logo">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Loops & Play" />
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
              disabled={submitting}
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
              disabled={submitting}
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="login-btn" disabled={submitting || authLoading}>
            {submitting ? 'Connexion…' : 'Se connecter'}
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
            <a href="https://wa.me/33759541545?text=Bonjour%20J%C3%A9r%C3%B4me%20!%20Je%20souhaite%20r%C3%A9server%20mon%20cours%20d%27essai%20gratuit." target="_blank" rel="noopener noreferrer">
              Réserve ton cours d'essai gratuit
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}
