import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const PACK_LABELS = {
  demo: 'Démo',
  resident: 'Résident',
  headliner: 'Headliner',
}

const PACK_ORDER = ['demo', 'resident', 'headliner']

const CATEGORIES = [
  { key: 'mix', label: 'Cours de Mix', icon: '🎚️' },
  { key: 'mao', label: 'Cours de MAO', icon: '🎹' },
]

export default function Formations() {
  const { profile, loading: authLoading } = useAuth()
  const [formations, setFormations] = useState([])
  const [progression, setProgression] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('mix')

  const isAdmin = profile?.role === 'admin'
  const userHasMix = isAdmin || !!profile?.mix_pack
  const userHasMao = isAdmin || !!profile?.mao_pack

  useEffect(() => {
    if (authLoading || !profile?.id) return

    async function fetchData() {
      setLoading(true)
      setError(null)

      const [formationsRes, progressionRes] = await Promise.all([
        supabase.from('formations').select('*').order('ordre'),
        supabase
          .from('formations_progression')
          .select('formation_id')
          .eq('user_id', profile.id),
      ])

      if (formationsRes.error) {
        console.error('[formations] error:', formationsRes.error)
        setError(formationsRes.error.message)
      }

      setFormations(formationsRes.data || [])
      setProgression(
        new Set((progressionRes.data || []).map((p) => p.formation_id))
      )
      setLoading(false)
    }

    fetchData()
  }, [profile?.id, authLoading])

  // Au mount : si l'user n'a pas accès à Mix, on bascule sur MAO par défaut
  useEffect(() => {
    if (!authLoading && profile) {
      if (!userHasMix && userHasMao) {
        setActiveTab('mao')
      }
    }
  }, [authLoading, profile, userHasMix, userHasMao])

  // Modules de la catégorie active
  const visibleFormations = useMemo(
    () => formations.filter((f) => f.categorie === activeTab),
    [formations, activeTab]
  )

  const grouped = useMemo(() => {
    return visibleFormations.reduce((acc, f) => {
      if (!acc[f.pack_required]) acc[f.pack_required] = []
      acc[f.pack_required].push(f)
      return acc
    }, {})
  }, [visibleFormations])

  const totalCompleted = visibleFormations.filter((f) => progression.has(f.id)).length
  const total = visibleFormations.length

  const userHasAccessToCurrentTab =
    activeTab === 'mix' ? userHasMix : userHasMao

  if (authLoading || loading) {
    return (
      <div className="container">
        <p style={{ color: 'hsl(var(--muted-foreground))' }}>Chargement des formations…</p>
      </div>
    )
  }

  return (
    <div className="container">
      <header className="app-page-header">
        <p className="app-page-eyebrow">Formations</p>
        <h1 className="app-page-title">Tes modules vidéo</h1>
        <p className="app-page-subtitle">
          {userHasAccessToCurrentTab && total > 0 && (
            <>
              <strong style={{ color: 'hsl(var(--foreground))' }}>{totalCompleted}/{total}</strong>{' '}
              modules terminés en {activeTab === 'mix' ? 'Mix' : 'MAO'}
            </>
          )}
          {!userHasAccessToCurrentTab && (
            <>Tu n'as pas encore d'accès aux cours de {activeTab === 'mix' ? 'Mix' : 'MAO'}.</>
          )}
        </p>
      </header>

      {/* ====== Tabs Mix / MAO ====== */}
      <div className="formations-tabs">
        {CATEGORIES.map((cat) => {
          const hasAccess = cat.key === 'mix' ? userHasMix : userHasMao
          return (
            <button
              key={cat.key}
              className={`formations-tab${activeTab === cat.key ? ' is-active' : ''}${!hasAccess ? ' is-locked' : ''}`}
              onClick={() => setActiveTab(cat.key)}
            >
              <span className="formations-tab-icon">{cat.icon}</span>
              <span className="formations-tab-label">{cat.label}</span>
              {!hasAccess && <span className="formations-tab-lock">🔒</span>}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="formations-error">
          Erreur de chargement : {error}
        </div>
      )}

      {/* ====== Upsell : l'user n'a pas accès à la catégorie active ====== */}
      {!userHasAccessToCurrentTab && (
        <div className="formations-upsell">
          <div className="formations-upsell-icon">{activeTab === 'mix' ? '🎚️' : '🎹'}</div>
          <h2>Débloquer les {activeTab === 'mix' ? 'cours de Mix' : 'cours de MAO'}</h2>
          <p>
            {activeTab === 'mix'
              ? 'Apprends à mixer du beatmatching aux sets en harmonique, structure de set, EQ, effets, lecture de piste et plus.'
              : 'Découvre la production musicale assistée par ordinateur : ton premier track, arrangement, sound design, mastering.'}
          </p>
          <a
            href={`https://wa.me/33759541545?text=${encodeURIComponent(
              `Bonjour Jérôme ! Je suis adhérent et je souhaite ajouter les cours de ${activeTab === 'mix' ? 'Mix' : 'MAO'} à mon parcours.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Demander à Jérôme
          </a>
        </div>
      )}

      {/* ====== Liste des modules de la catégorie ====== */}
      {userHasAccessToCurrentTab && total === 0 && !error && (
        <div className="placeholder-block">
          <span className="badge">Bientôt disponible</span>
          <p>Les modules de ce parcours arrivent bientôt. Jérôme tourne en ce moment les premières capsules.</p>
        </div>
      )}

      {userHasAccessToCurrentTab && PACK_ORDER.map((pack) => {
        const list = grouped[pack]
        if (!list || list.length === 0) return null
        const sectionCompleted = list.filter((f) => progression.has(f.id)).length

        return (
          <section key={pack} className="formations-section">
            <div className="formations-pack-header">
              <h2 className="formations-pack-title">
                Niveau <span className="accent">{PACK_LABELS[pack]}</span>
              </h2>
              <span className="formations-pack-count">
                {sectionCompleted}/{list.length}
              </span>
            </div>

            <div className="formations-grid">
              {list.map((f) => {
                const done = progression.has(f.id)
                return (
                  <Link
                    to={`/formations/${f.id}`}
                    key={f.id}
                    className={`formation-card${done ? ' is-done' : ''}`}
                  >
                    <div className="formation-card-num">
                      {String(f.ordre).padStart(2, '0')}
                    </div>
                    <div className="formation-card-body">
                      <h3>{f.titre}</h3>
                      {f.description && <p>{f.description}</p>}
                      <div className="formation-card-meta">
                        {f.duree_min && <span>{f.duree_min} min</span>}
                        {!f.video_youtube_id && (
                          <span className="formation-card-soon">Bientôt</span>
                        )}
                        {done && (
                          <span className="formation-card-done">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Vu
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
