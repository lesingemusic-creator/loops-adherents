import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { BUCKET, chargerMembres, heure, nomAffiche } from '../../lib/communaute'
import { Avatar } from './Message.jsx'
import Post, { Reactions, Texte, enregistrerEcoute } from './Post.jsx'
import { Fichier, Integration } from './Message.jsx'
import Composer from './Composer.jsx'
import Stories from './Stories.jsx'
import '../../styles/communaute-flow.css'

/**
 * La Communaute, DA « Le Flow » (choisie par Freddy le 26/09/2026).
 * Un fil vertical : stories de Jerome, pistes (salons), publications en
 * cartes, reponses dans un panneau, messages prives, serie de jours,
 * « en rotation », defi de la semaine. Tout en temps reel.
 */

const PAGE = 25
const ORDRE_PISTES = ['general', 'showcase', 'feedback-mix', 'ressources', 'contenu-exclusif', 'annonces', 'regles']
const NOMS_PISTES = { general: 'Général', showcase: 'Showcase', 'feedback-mix': 'Feedback mix', ressources: 'Ressources', 'contenu-exclusif': 'Exclu', annonces: 'Annonces', regles: 'Règles' }

export default function Flow() {
  const { user, profile } = useAuth()
  const moi = user?.id
  const admin = profile?.role === 'admin'

  const [membres, setMembres] = useState({})
  const [salons, setSalons] = useState([])
  const [piste, setPiste] = useState('tout')
  const [posts, setPosts] = useState([])
  const [reactions, setReactions] = useState({})
  const [plus, setPlus] = useState(false)
  const [nonLus, setNonLus] = useState({})
  const [stories, setStories] = useState([])
  const [serie, setSerie] = useState(0)
  const [rotation, setRotation] = useState([])
  const [defi, setDefi] = useState(null)
  const [prives, setPrives] = useState([])
  const [vue, setVue] = useState('flux') // flux | prives | prive:<conversation>
  const [fil, setFil] = useState(null)
  const [filMessages, setFilMessages] = useState([])
  const [cible, setCible] = useState(null) // salon ou l'on publie
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [signalement, setSignalement] = useState(null)
  const [nouveaux, setNouveaux] = useState(0)

  const pisteRef = useRef(piste); pisteRef.current = piste
  const filRef = useRef(fil); filRef.current = fil
  const vueRef = useRef(vue); vueRef.current = vue
  const salonsRef = useRef(salons); salonsRef.current = salons
  const composer = useRef(null)

  const salonParId = useMemo(() => Object.fromEntries(salons.map((s) => [s.id, s])), [salons])
  const salonParSlug = useMemo(() => Object.fromEntries(salons.map((s) => [s.slug, s])), [salons])
  const pistes = useMemo(() => ORDRE_PISTES.map((sl) => salonParSlug[sl]).filter(Boolean), [salonParSlug])
  const ecrivables = useMemo(() => pistes.filter((s) => admin || s.ecriture === 'tous'), [pistes, admin])

  /* ---------- Chargements ---------- */

  const chargerReactions = useCallback(async (ids) => {
    if (!ids.length) return
    const { data } = await supabase.from('comm_reactions').select('message_id,user_id,emoji').in('message_id', ids)
    setReactions((r) => {
      const n = { ...r }
      ids.forEach((id) => { n[id] = [] })
      ;(data || []).forEach((x) => { n[x.message_id].push(x) })
      return n
    })
  }, [])

  const chargerCote = useCallback(async () => {
    const [st, ro, de, pv, nl] = await Promise.all([
      supabase.rpc('comm_stories'), supabase.rpc('comm_rotation'), supabase.rpc('comm_defi'),
      supabase.rpc('comm_mes_prives'), supabase.rpc('comm_non_lus_salons'),
    ])
    if (!st.error) setStories(st.data || [])
    if (!ro.error) setRotation(ro.data || [])
    if (!de.error) setDefi(de.data?.[0] || null)
    if (!pv.error) setPrives(pv.data || [])
    if (!nl.error) setNonLus(Object.fromEntries((nl.data || []).map((r) => [r.salon_id, r.non_lus])))
  }, [])

  useEffect(() => {
    let vivant = true
    ;(async () => {
      try {
        const [mb, sl, se] = await Promise.all([
          chargerMembres(true),
          supabase.from('comm_salons').select('*').order('ordre'),
          supabase.rpc('comm_serie'),
        ])
        if (!vivant) return
        if (sl.error) throw sl.error
        setMembres(mb)
        setSalons(sl.data || [])
        setSerie(se.data || 0)
        await chargerCote()
      } catch (e) {
        setErreur('Chargement de la communauté impossible : ' + e.message)
      }
      setChargement(false)
    })()
    return () => { vivant = false }
  }, [chargerCote])

  const chargerPosts = useCallback(async (p, avant = null) => {
    let q = supabase.from('comm_messages').select('*').is('parent_id', null).not('salon_id', 'is', null)
      .order('created_at', { ascending: false }).limit(PAGE)
    if (p !== 'tout') q = q.eq('salon_id', p)
    else {
      const regles = salonsRef.current.find((s) => s.slug === 'regles')
      if (regles) q = q.neq('salon_id', regles.id)
    }
    if (avant) q = q.lt('created_at', avant)
    const { data, error } = await q
    if (error) { setErreur(error.message); return }
    let lot = data || []
    setPlus(lot.length === PAGE)
    if (!avant && p !== 'tout') lot = [...lot.filter((x) => x.epingle), ...lot.filter((x) => !x.epingle)]
    setPosts((l) => (avant ? [...l, ...lot] : lot))
    chargerReactions(lot.map((x) => x.id))
  }, [chargerReactions])

  // Changement de piste : charger et marquer lu
  useEffect(() => {
    if (!salons.length) return
    setNouveaux(0)
    chargerPosts(piste)
    const aLire = piste === 'tout' ? salons.map((s) => s.id) : [piste]
    aLire.forEach((id) => supabase.rpc('comm_marquer_lu', { p_salon: id }))
    setNonLus((n) => { const x = { ...n }; aLire.forEach((id) => { x[id] = 0 }); return x })
    if (piste !== 'tout') setCible(piste)
  }, [piste, salons, chargerPosts])

  // Salon de publication par defaut
  useEffect(() => {
    if (!cible && ecrivables.length) setCible((salonParSlug.general || ecrivables[0]).id)
  }, [cible, ecrivables, salonParSlug])

  /* ---------- Temps reel ---------- */

  useEffect(() => {
    let minuteur = null
    const cotePlusTard = () => { clearTimeout(minuteur); minuteur = setTimeout(chargerCote, 500) }

    const canal = supabase.channel('flow-' + moi)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comm_messages' }, (p) => {
        const m = p.new
        if (p.eventType === 'INSERT') {
          const pi = pisteRef.current
          const f = filRef.current
          const v = vueRef.current
          if (m.salon_id && !m.parent_id && (pi === 'tout' || pi === m.salon_id)) {
            setPosts((l) => (l.some((x) => x.id === m.id) ? l : [m, ...l]))
            setReactions((r) => ({ ...r, [m.id]: r[m.id] || [] }))
            if (m.auteur_id !== moi) {
              setNouveaux((n) => (window.scrollY > 400 ? n + 1 : n))
              supabase.rpc('comm_marquer_lu', { p_salon: m.salon_id })
            }
          } else if (f && m.parent_id === f.id) {
            setFilMessages((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]))
          } else if (m.conversation_id && v === 'prive:' + m.conversation_id) {
            setFilMessages((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]))
            supabase.rpc('comm_marquer_lu', { p_conversation: m.conversation_id })
          }
          if (!membresConnu(m.auteur_id)) chargerMembres(true).then(setMembres)
          cotePlusTard()
        }
        if (p.eventType === 'UPDATE') {
          const maj = (l) => l.map((x) => (x.id === m.id ? { ...x, ...m } : x))
          setPosts(maj)
          setFilMessages(maj)
          setFil((x) => (x && x.id === m.id ? { ...x, ...m } : x))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comm_reactions' }, (p) => {
        if (p.eventType === 'INSERT') {
          const r = p.new
          setReactions((all) => {
            const l = all[r.message_id]
            if (!l || l.some((x) => x.user_id === r.user_id && x.emoji === r.emoji)) return all
            return { ...all, [r.message_id]: [...l, r] }
          })
        }
        if (p.eventType === 'DELETE') {
          const r = p.old
          setReactions((all) => {
            const l = all[r.message_id]
            if (!l) return all
            return { ...all, [r.message_id]: l.filter((x) => !(x.user_id === r.user_id && x.emoji === r.emoji)) }
          })
        }
      })
      .subscribe()
    return () => { clearTimeout(minuteur); supabase.removeChannel(canal) }
  }, [moi, chargerCote]) // eslint-disable-line react-hooks/exhaustive-deps

  const membresRef = useRef(membres); membresRef.current = membres
  function membresConnu(id) { return !!membresRef.current[id] }

  /* ---------- Actions ---------- */

  async function publier(champs, { parent = null, conversation = null } = {}) {
    const ligne = {
      auteur_id: moi,
      contenu: champs.contenu,
      mentions: champs.mentions || [],
      parent_id: parent?.id || null,
      salon_id: conversation ? null : (parent ? parent.salon_id : cible),
      conversation_id: conversation,
      fichier_chemin: champs.fichier_chemin || null,
      fichier_type: champs.fichier_type || null,
      fichier_nom: champs.fichier_nom || null,
      fichier_taille: champs.fichier_taille || null,
    }
    const { data, error } = await supabase.from('comm_messages').insert(ligne).select('*').single()
    if (error) {
      if (champs.fichier_chemin) await supabase.storage.from(BUCKET).remove([champs.fichier_chemin])
      throw new Error(error.code === '42501' ? 'Tu ne peux pas publier ici.' : error.message)
    }
    setReactions((r) => ({ ...r, [data.id]: [] }))
    if (parent || conversation) {
      setFilMessages((l) => (l.some((x) => x.id === data.id) ? l : [...l, data]))
    } else if (piste === 'tout' || piste === data.salon_id) {
      setPosts((l) => (l.some((x) => x.id === data.id) ? l : [data, ...l]))
    } else {
      setPiste(data.salon_id)
    }
    if (conversation) chargerCote()
  }

  async function reagir(m, emoji, dejaMis) {
    if (dejaMis) {
      setReactions((all) => ({ ...all, [m.id]: (all[m.id] || []).filter((x) => !(x.user_id === moi && x.emoji === emoji)) }))
      await supabase.from('comm_reactions').delete().match({ message_id: m.id, user_id: moi, emoji })
    } else {
      setReactions((all) => ({ ...all, [m.id]: [...(all[m.id] || []), { message_id: m.id, user_id: moi, emoji }] }))
      await supabase.from('comm_reactions').insert({ message_id: m.id, user_id: moi, emoji })
    }
  }

  async function modifier(m, contenu) {
    const { error } = await supabase.rpc('comm_modifier', { p_id: m.id, p_contenu: contenu })
    if (error) setErreur(error.message)
  }
  async function supprimer(m) {
    if (!window.confirm('Supprimer cette publication ?')) return
    const { data, error } = await supabase.rpc('comm_supprimer', { p_id: m.id })
    if (error) { setErreur(error.message); return }
    if (data) await supabase.storage.from(BUCKET).remove([data])
  }
  async function epingler(m) {
    const { error } = await supabase.rpc('comm_epingler', { p_id: m.id, p_epingle: !m.epingle })
    if (error) setErreur(error.message)
  }
  async function ecoute(m) {
    const n = await enregistrerEcoute(m.id)
    if (typeof n === 'number') setPosts((l) => l.map((x) => (x.id === m.id ? { ...x, nb_ecoutes: n } : x)))
  }
  async function envoyerSignalement(e) {
    e.preventDefault()
    const { error } = await supabase.rpc('comm_signaler', { p_id: signalement.m.id, p_raison: signalement.raison })
    setSignalement(error ? { ...signalement, erreur: error.message } : { ...signalement, fait: true })
  }

  async function ouvrirFil(m) {
    setFil(m)
    setFilMessages([])
    const { data } = await supabase.from('comm_messages').select('*').eq('parent_id', m.id).order('created_at')
    setFilMessages(data || [])
    chargerReactions([m.id, ...(data || []).map((x) => x.id)])
  }

  async function ouvrirConversation(conversationId) {
    setVue('prive:' + conversationId)
    setFilMessages([])
    const { data } = await supabase.from('comm_messages').select('*').eq('conversation_id', conversationId)
      .order('created_at', { ascending: false }).limit(80)
    setFilMessages((data || []).reverse())
    await supabase.rpc('comm_marquer_lu', { p_conversation: conversationId })
    setPrives((p) => p.map((x) => (x.conversation_id === conversationId ? { ...x, non_lus: 0 } : x)))
    window.scrollTo({ top: 0 })
  }

  async function nouvelleConversation(membreId) {
    const { data, error } = await supabase.rpc('comm_ouvrir_prive', { p_autre: membreId })
    if (error) { setErreur(error.message); return }
    if (!prives.some((p) => p.conversation_id === data)) {
      setPrives((p) => [{ conversation_id: data, autre_id: membreId, non_lus: 0 }, ...p])
    }
    ouvrirConversation(data)
  }

  function publierAnnonce() {
    if (salonParSlug.annonces) { setCible(salonParSlug.annonces.id); setVue('flux') }
    composer.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => composer.current?.querySelector('textarea')?.focus(), 350)
  }

  /* ---------- Rendu ---------- */

  if (chargement) return <div className="fl-attente">Chargement de la communauté...</div>
  if (profile?.communaute_bloque) {
    return <div className="fl-attente">Ton accès à la communauté est suspendu. Écris à Jérôme sur WhatsApp si tu penses que c'est une erreur.</div>
  }

  const prvNonLus = prives.reduce((t, p) => t + (p.non_lus || 0), 0)
  const convOuverte = vue.startsWith('prive:') ? prives.find((p) => p.conversation_id === vue.slice(6)) : null
  const salonCible = salonParId[cible]

  const cote = (
    <aside className="fl-cote" aria-label="En ce moment">
      {defi && (
        <section className="fl-bloc fl-defi">
          <h2>🎯 Défi de la semaine</h2>
          <p className="fl-defi-titre">{defi.titre}</p>
          {defi.texte && <p>{defi.texte}</p>}
          <div className="fl-progres"><i style={{ transform: `scaleX(${defi.membres ? Math.min(1, defi.participants / defi.membres) : 0})` }} /></div>
          <small>{defi.participants} élève{defi.participants > 1 ? 's' : ''} sur {defi.membres} ont relevé le défi{defi.moi ? ', dont toi 💪' : ''}</small>
          {!defi.moi && salonParSlug[defi.salon] && (
            <button type="button" className="fl-lien" onClick={() => { setPiste(salonParSlug[defi.salon].id); setVue('flux') }}>Relever le défi →</button>
          )}
        </section>
      )}
      {rotation.length > 0 && (
        <section className="fl-bloc">
          <h2>🔥 En rotation cette semaine</h2>
          <ol className="fl-rotation">
            {rotation.map((r, i) => (
              <li key={r.id}>
                <span className="fl-rang">{i + 1}</span>
                <div className="fl-rot-t"><b>{r.fichier_nom || (r.contenu || '').slice(0, 40) || 'Publication'}</b><small>{nomAffiche(membres[r.auteur_id])} · {NOMS_PISTES[r.salon]}</small></div>
                <span className="fl-rot-n">{r.ecoutes > r.reactions ? `${r.ecoutes} ▶` : r.reactions > 0 ? `${r.reactions} 🔥` : 'nouveau'}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className="fl-bloc fl-bloc--prives">
        <h2>💬 Messages privés {prvNonLus > 0 && <span className="fl-compte">{prvNonLus}</span>}</h2>
        <ul className="fl-dm">
          {prives.slice(0, 4).map((p) => (
            <li key={p.conversation_id}>
              <button type="button" onClick={() => ouvrirConversation(p.conversation_id)}>
                <Avatar membre={membres[p.autre_id]} taille={38} />
                <span className="fl-dm-t"><b>{nomAffiche(membres[p.autre_id])}</b></span>
                {p.non_lus > 0 && <span className="fl-pt" aria-label={`${p.non_lus} non lu(s)`} />}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="fl-lien" onClick={() => setVue('prives')}>{prives.length ? 'Tous les messages →' : 'Écrire à quelqu\'un →'}</button>
      </section>
    </aside>
  )

  return (
    <div className="fl">
      {/* ---------- En-tete ---------- */}
      <div className="fl-tete">
        <h1>Commu<span>.</span></h1>
        <div className="fl-tete-droite">
          <button type="button" className={`fl-chip ${vue !== 'flux' ? 'is-on' : ''}`} onClick={() => setVue(vue === 'flux' ? 'prives' : 'flux')}>
            {vue === 'flux' ? <>💬 Messages{prvNonLus > 0 && <span className="fl-compte">{prvNonLus}</span>}</> : '← Le fil'}
          </button>
          {serie > 0 && (
            <div className="fl-serie" title={`Tu es passé ${serie} jour${serie > 1 ? 's' : ''} de suite`}>
              <i aria-hidden="true">🔥</i>{serie} jour{serie > 1 ? 's' : ''}<small> d'affilée</small>
            </div>
          )}
        </div>
      </div>

      {erreur && <p className="fl-erreur" onClick={() => setErreur(null)}>{erreur}</p>}

      {vue === 'flux' && (
        <>
          <Stories stories={stories} membres={membres} admin={admin}
            onVu={(id) => setStories((l) => l.map((s) => (s.id === id ? { ...s, vue: true } : s)))}
            onNouvelle={publierAnnonce} />

          <div className="fl-grille">
            {cote}
            <main className="fl-fil-principal">
              <nav className="fl-pistes" aria-label="Salons">
                <button type="button" className={`fl-piste ${piste === 'tout' ? 'is-on' : ''}`} onClick={() => setPiste('tout')}>Tout</button>
                {pistes.map((s) => (
                  <button key={s.id} type="button" className={`fl-piste ${piste === s.id ? 'is-on' : ''}`} onClick={() => setPiste(s.id)}>
                    {nonLus[s.id] > 0 && piste !== s.id && <span className="fl-pt" aria-hidden="true" />}
                    {NOMS_PISTES[s.slug] || s.nom}
                    {s.ecriture === 'moderateurs' && <span className="fl-cadenas" aria-label="Seul Jérôme publie">🔒</span>}
                  </button>
                ))}
              </nav>

              {nouveaux > 0 && (
                <button type="button" className="fl-nouveaux" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setNouveaux(0) }}>
                  ↑ {nouveaux} nouvelle{nouveaux > 1 ? 's' : ''} publication{nouveaux > 1 ? 's' : ''}
                </button>
              )}

              <div className="fl-publier" ref={composer}>
                {ecrivables.length > 0 && (piste === 'tout' || ecrivables.some((s) => s.id === piste)) ? (
                  <>
                    <div className="fl-publier-ligne">
                      <Avatar membre={membres[moi]} taille={42} />
                      <Composer
                        key={'pub-' + cible}
                        membres={membres}
                        moi={moi}
                        placeholder={salonCible?.slug === 'annonces' ? 'Ton annonce (la 1re ligne devient le titre)' : 'Balance ton mix, ta question, ta prod...'}
                        onEnvoyer={(c) => publier(c)}
                      />
                    </div>
                    {piste === 'tout' && (
                      <label className="fl-cible">Dans
                        <select value={cible || ''} onChange={(e) => setCible(e.target.value)}>
                          {ecrivables.map((s) => <option key={s.id} value={s.id}>{NOMS_PISTES[s.slug] || s.nom}</option>)}
                        </select>
                      </label>
                    )}
                  </>
                ) : (
                  <p className="fl-lecture-seule">Seul Jérôme publie ici. Tu peux répondre sous chaque publication.</p>
                )}
              </div>

              {posts.length === 0 && (
                <div className="fl-vide">
                  <h3>C'est calme ici</h3>
                  <p>Lance le mouvement : présente-toi, pose une question ou partage ton dernier son.</p>
                </div>
              )}

              {posts.map((m) => (
                <Post key={m.id} m={m} membres={membres} moi={moi} admin={admin}
                  reactions={reactions[m.id]} salon={salonParId[m.salon_id]}
                  onReagir={reagir} onFil={ouvrirFil} onModifier={modifier} onSupprimer={supprimer}
                  onEpingler={epingler} onSignaler={(x) => setSignalement({ m: x, raison: '' })} onEcoute={ecoute} />
              ))}

              {plus && (
                <button type="button" className="fl-charger" onClick={() => chargerPosts(piste, posts[posts.length - 1]?.created_at)}>
                  Voir plus
                </button>
              )}
            </main>
          </div>
        </>
      )}

      {/* ---------- Messages prives : liste ---------- */}
      {vue === 'prives' && (
        <Prives prives={prives} membres={membres} moi={moi} onOuvrir={ouvrirConversation} onNouveau={nouvelleConversation} />
      )}

      {/* ---------- Messages prives : conversation ---------- */}
      {vue.startsWith('prive:') && (
        <section className="fl-conv">
          <header className="fl-conv-tete">
            <button type="button" className="fl-retour" onClick={() => { setVue('prives'); setFilMessages([]) }} aria-label="Retour">←</button>
            <Avatar membre={membres[convOuverte?.autre_id]} taille={40} />
            <div><b>{nomAffiche(membres[convOuverte?.autre_id])}</b><small>Conversation privée</small></div>
          </header>
          <div className="fl-bulles">
            {filMessages.length === 0 && <p className="fl-vide-petit">Dis-lui bonjour 👋</p>}
            {filMessages.map((m) => <Bulle key={m.id} m={m} moi={moi} membres={membres} />)}
          </div>
          <div className="fl-conv-saisie">
            <Composer key={'dm-' + vue} membres={membres} moi={moi} placeholder={`Écrire à ${nomAffiche(membres[convOuverte?.autre_id])}`}
              onEnvoyer={(c) => publier(c, { conversation: vue.slice(6) })} />
          </div>
        </section>
      )}

      {/* ---------- Fil de reponses (panneau) ---------- */}
      <div className={`fl-panneau ${fil ? 'is-ouvert' : ''}`} aria-hidden={!fil}>
        <div className="fl-voile" onClick={() => setFil(null)} />
        {fil && (
          <section className="fl-feuille" role="dialog" aria-modal="true" aria-label="Réponses">
            <div className="fl-poignee" />
            <header className="fl-feuille-tete">
              <h3>Réponses</h3>
              <button type="button" className="fl-fermer" aria-label="Fermer" onClick={() => setFil(null)}>×</button>
            </header>
            <div className="fl-origine">
              <Avatar membre={membres[fil.auteur_id]} taille={34} />
              <div>
                <b>{nomAffiche(membres[fil.auteur_id])}</b>
                <Texte contenu={fil.contenu} membres={membres} />
                {fil.fichier_nom && <small className="fl-meta">📎 {fil.fichier_nom}</small>}
              </div>
            </div>
            <div className="fl-bulles fl-bulles--fil">
              {filMessages.length === 0 && <p className="fl-vide-petit">Sois le premier à répondre.</p>}
              {filMessages.map((m) => (
                <div key={m.id}>
                  <Bulle m={m} moi={moi} membres={membres} />
                  {!m.supprime_le && (
                    <div className={`fl-bulle-reacs ${m.auteur_id === moi ? 'is-moi' : ''}`}>
                      <Reactions m={m} reactions={reactions[m.id]} moi={moi} membres={membres} onReagir={reagir} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="fl-feuille-saisie">
              <Composer key={'fil-' + fil.id} membres={membres} moi={moi} placeholder="Répondre..."
                onEnvoyer={(c) => publier(c, { parent: fil })} />
            </div>
          </section>
        )}
      </div>

      {/* ---------- Signalement ---------- */}
      {signalement && (
        <div className="fl-modale" role="dialog" aria-modal="true" aria-label="Signaler" onClick={() => setSignalement(null)}>
          <form className="fl-modale-boite" onClick={(e) => e.stopPropagation()} onSubmit={envoyerSignalement}>
            <h3>Signaler à Jérôme</h3>
            {signalement.fait ? (
              <><p>Merci, Jérôme a reçu ton signalement.</p><button type="button" className="fl-bouton" onClick={() => setSignalement(null)}>Fermer</button></>
            ) : (
              <>
                <p className="fl-meta">« {signalement.m.contenu?.slice(0, 200) || signalement.m.fichier_nom} »</p>
                <textarea rows={3} placeholder="Ce qui ne va pas (facultatif)" value={signalement.raison}
                  onChange={(e) => setSignalement({ ...signalement, raison: e.target.value })} />
                {signalement.erreur && <p className="fl-erreur">{signalement.erreur}</p>}
                <div className="fl-modale-actions">
                  <button type="submit" className="fl-bouton">Envoyer</button>
                  <button type="button" className="fl-lien" onClick={() => setSignalement(null)}>Annuler</button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  )
}

/* ---------- Bulle (reponses et messages prives) ---------- */

function Bulle({ m, moi, membres }) {
  const moiAuteur = m.auteur_id === moi
  const auteur = membres[m.auteur_id]
  if (m.supprime_le) return <div className={`fl-bulle ${moiAuteur ? 'is-moi' : ''}`}><div className="fl-bulle-corps fl-bulle--supprime">Message supprimé</div></div>
  return (
    <div className={`fl-bulle ${moiAuteur ? 'is-moi' : ''}`}>
      {!moiAuteur && <Avatar membre={auteur} taille={32} />}
      <div className="fl-bulle-corps">
        {!moiAuteur && <b>{nomAffiche(auteur)}{auteur?.moderateur && <span className="fl-pill fl-pill--jaune">Équipe</span>}</b>}
        <Texte contenu={m.contenu} membres={membres} />
        <Integration texte={m.contenu} />
        <Fichier m={m} />
        <small>{heure(m.created_at)}</small>
      </div>
    </div>
  )
}

/* ---------- Liste des messages prives ---------- */

function Prives({ prives, membres, moi, onOuvrir, onNouveau }) {
  const [choix, setChoix] = useState(false)
  const [recherche, setRecherche] = useState('')
  return (
    <section className="fl-prives">
      <div className="fl-prives-tete">
        <h2>Messages privés</h2>
        <button type="button" className="fl-bouton" onClick={() => setChoix(!choix)}>{choix ? 'Fermer' : '+ Nouveau'}</button>
      </div>
      {choix && (
        <div className="fl-bloc">
          <input className="fl-recherche" type="search" placeholder="Chercher un membre" value={recherche} autoFocus
            onChange={(e) => setRecherche(e.target.value)} />
          <ul className="fl-dm">
            {Object.values(membres)
              .filter((m) => m.id !== moi && nomAffiche(m).toLowerCase().includes(recherche.toLowerCase()))
              .map((m) => (
                <li key={m.id}><button type="button" onClick={() => onNouveau(m.id)}>
                  <Avatar membre={m} taille={38} /><span className="fl-dm-t"><b>{nomAffiche(m)}</b>{m.moderateur && <small>Équipe Loops & Play</small>}</span>
                </button></li>
              ))}
          </ul>
        </div>
      )}
      {prives.length === 0 && !choix && <p className="fl-vide-petit">Aucune conversation pour l'instant. Écris à Jérôme ou à un autre élève.</p>}
      <ul className="fl-dm fl-dm--grand">
        {prives.map((p) => (
          <li key={p.conversation_id}><button type="button" onClick={() => onOuvrir(p.conversation_id)}>
            <Avatar membre={membres[p.autre_id]} taille={46} />
            <span className="fl-dm-t"><b>{nomAffiche(membres[p.autre_id])}</b>{p.dernier_message_le && <small>{heure(p.dernier_message_le)}</small>}</span>
            {p.non_lus > 0 && <span className="fl-compte">{p.non_lus}</span>}
          </button></li>
        ))}
      </ul>
    </section>
  )
}
