import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { CATEGORIES, chargerMembres, jourSeparateur, nomAffiche, BUCKET } from '../../lib/communaute'
import Message, { Avatar } from './Message.jsx'
import Composer from './Composer.jsx'
import '../../styles/communaute-maison.css'

/**
 * La Communaute maison (plan B du 26/09/2026).
 * Les salons du serveur Discord de Jerome, dans le Backstage : pas de
 * compte a creer, pas d'invitation, chaque eleve est deja membre.
 */

const PAGE = 50
const COLONNES = '*'

function regrouper(liste) {
  // Messages consecutifs du meme auteur a moins de 5 minutes : un seul en-tete.
  return liste.map((m, i) => {
    const p = liste[i - 1]
    const jourChange = !p || new Date(p.created_at).toDateString() !== new Date(m.created_at).toDateString()
    const suite = !!p && !jourChange && p.auteur_id === m.auteur_id && !p.supprime_le &&
      new Date(m.created_at) - new Date(p.created_at) < 5 * 60 * 1000
    return { m, suite, jourChange }
  })
}

export default function CommunauteMaison({ apercu }) {
  const { user, profile } = useAuth()
  const moi = user?.id
  const admin = profile?.role === 'admin'

  const [membres, setMembres] = useState({})
  const [salons, setSalons] = useState([])
  const [nonLus, setNonLus] = useState({})
  const [prives, setPrives] = useState([])
  const [vue, setVue] = useState(null)             // { type: 'salon'|'prive', id }
  const [messages, setMessages] = useState([])
  const [reactions, setReactions] = useState({})   // message_id -> [{user_id, emoji}]
  const [plusAncien, setPlusAncien] = useState(false)
  const [chargement, setChargement] = useState(true)
  const [fil, setFil] = useState(null)
  const [filMessages, setFilMessages] = useState([])
  const [epingles, setEpingles] = useState(false)
  const [choixMembre, setChoixMembre] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [tiroir, setTiroir] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [signalement, setSignalement] = useState(null)

  const vueRef = useRef(null)
  const filRef = useRef(null)
  const liste = useRef(null)
  const collerEnBas = useRef(true)
  vueRef.current = vue
  filRef.current = fil

  const salon = vue?.type === 'salon' ? salons.find((s) => s.id === vue.id) : null
  const prive = vue?.type === 'prive' ? prives.find((p) => p.conversation_id === vue.id) : null
  const autre = prive ? membres[prive.autre_id] : (vue?.type === 'prive' ? membres[vue.autre] : null)

  /* ---------- Chargements ---------- */

  const rafraichirCompteurs = useCallback(async () => {
    const [nl, pv] = await Promise.all([
      supabase.rpc('comm_non_lus_salons'),
      supabase.rpc('comm_mes_prives'),
    ])
    if (!nl.error) setNonLus(Object.fromEntries((nl.data || []).map((r) => [r.salon_id, r.non_lus])))
    if (!pv.error) setPrives(pv.data || [])
  }, [])

  useEffect(() => {
    let vivant = true
    ;(async () => {
      try {
        const [mb, sl] = await Promise.all([
          chargerMembres(true),
          supabase.from('comm_salons').select('*').order('ordre'),
        ])
        if (!vivant) return
        if (sl.error) throw sl.error
        setMembres(mb)
        setSalons(sl.data || [])
        await rafraichirCompteurs()
        const general = (sl.data || []).find((s) => s.slug === 'general') || sl.data?.[0]
        if (general) setVue({ type: 'salon', id: general.id })
      } catch (e) {
        setErreur('Chargement de la communauté impossible : ' + e.message)
      }
      setChargement(false)
    })()
    return () => { vivant = false }
  }, [rafraichirCompteurs])

  async function chargerReactions(ids) {
    if (!ids.length) return
    const { data } = await supabase.from('comm_reactions').select('message_id,user_id,emoji').in('message_id', ids)
    setReactions((r) => {
      const n = { ...r }
      ids.forEach((id) => { n[id] = [] })
      ;(data || []).forEach((x) => { n[x.message_id].push(x) })
      return n
    })
  }

  const chargerVue = useCallback(async (v, avant = null) => {
    let q = supabase.from('comm_messages').select(COLONNES).is('parent_id', null)
      .order('created_at', { ascending: false }).limit(PAGE)
    q = v.type === 'salon' ? q.eq('salon_id', v.id) : q.eq('conversation_id', v.id)
    if (avant) q = q.lt('created_at', avant)
    const { data, error } = await q
    if (error) { setErreur(error.message); return }
    const lot = (data || []).reverse()
    setPlusAncien((data || []).length === PAGE)
    if (avant) {
      setMessages((m) => [...lot, ...m])
    } else {
      collerEnBas.current = true
      setMessages(lot)
    }
    chargerReactions(lot.map((m) => m.id))
  }, [])

  const marquerLu = useCallback(async (v) => {
    if (!v) return
    await supabase.rpc('comm_marquer_lu', v.type === 'salon' ? { p_salon: v.id } : { p_conversation: v.id })
    if (v.type === 'salon') setNonLus((n) => ({ ...n, [v.id]: 0 }))
    else setPrives((p) => p.map((x) => (x.conversation_id === v.id ? { ...x, non_lus: 0 } : x)))
  }, [])

  useEffect(() => {
    if (!vue) return
    setMessages([])
    setFil(null)
    setEpingles(false)
    chargerVue(vue)
    marquerLu(vue)
  }, [vue?.type, vue?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Temps reel ---------- */

  useEffect(() => {
    let minuteur = null
    const compteursPlusTard = () => {
      clearTimeout(minuteur)
      minuteur = setTimeout(rafraichirCompteurs, 400)
    }

    const canal = supabase.channel('communaute-' + moi)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comm_messages' }, (p) => {
        const m = p.new
        const v = vueRef.current
        const f = filRef.current
        if (p.eventType === 'INSERT') {
          const dansVue = v && !m.parent_id && (v.type === 'salon' ? m.salon_id === v.id : m.conversation_id === v.id)
          if (dansVue) {
            setMessages((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]))
            if (m.auteur_id !== moi) marquerLu(v)
          } else if (f && m.parent_id === f.id) {
            setFilMessages((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]))
          }
          if (!dansVue || m.conversation_id) compteursPlusTard()
          if (!membresConnu(m.auteur_id)) chargerMembres(true).then(setMembres)
        }
        if (p.eventType === 'UPDATE') {
          const maj = (l) => l.map((x) => (x.id === m.id ? { ...x, ...m } : x))
          setMessages(maj)
          setFilMessages(maj)
          if (f && f.id === m.id) setFil((x) => ({ ...x, ...m }))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comm_reactions' }, (p) => {
        if (p.eventType === 'INSERT') {
          const r = p.new
          setReactions((all) => {
            const l = all[r.message_id]
            if (!l) return all
            if (l.some((x) => x.user_id === r.user_id && x.emoji === r.emoji)) return all
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
  }, [moi, marquerLu, rafraichirCompteurs]) // eslint-disable-line react-hooks/exhaustive-deps

  const membresRef = useRef(membres)
  membresRef.current = membres
  function membresConnu(id) { return !!membresRef.current[id] }

  /* ---------- Defilement ---------- */

  useLayoutEffect(() => {
    const el = liste.current
    if (el && collerEnBas.current) el.scrollTop = el.scrollHeight
  }, [messages])

  function surDefilement() {
    const el = liste.current
    if (!el) return
    collerEnBas.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  /* ---------- Actions ---------- */

  async function envoyer(champs, parent = null) {
    const v = vueRef.current
    const ligne = {
      auteur_id: moi,
      contenu: champs.contenu,
      mentions: champs.mentions || [],
      parent_id: parent?.id || null,
      salon_id: v.type === 'salon' ? v.id : null,
      conversation_id: v.type === 'prive' ? v.id : null,
      fichier_chemin: champs.fichier_chemin || null,
      fichier_type: champs.fichier_type || null,
      fichier_nom: champs.fichier_nom || null,
      fichier_taille: champs.fichier_taille || null,
    }
    const { data, error } = await supabase.from('comm_messages').insert(ligne).select(COLONNES).single()
    if (error) {
      if (champs.fichier_chemin) await supabase.storage.from(BUCKET).remove([champs.fichier_chemin])
      throw new Error(error.code === '42501' ? "Tu ne peux pas écrire ici." : error.message)
    }
    setReactions((r) => ({ ...r, [data.id]: [] }))
    if (parent) {
      setFilMessages((l) => (l.some((x) => x.id === data.id) ? l : [...l, data]))
    } else {
      collerEnBas.current = true
      setMessages((l) => (l.some((x) => x.id === data.id) ? l : [...l, data]))
      if (v.type === 'prive') rafraichirCompteurs()
    }
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
    if (!window.confirm('Supprimer ce message ?')) return
    const { data, error } = await supabase.rpc('comm_supprimer', { p_id: m.id })
    if (error) { setErreur(error.message); return }
    if (data) await supabase.storage.from(BUCKET).remove([data])
  }

  async function epingler(m) {
    const { error } = await supabase.rpc('comm_epingler', { p_id: m.id, p_epingle: !m.epingle })
    if (error) setErreur(error.message)
  }

  async function envoyerSignalement(e) {
    e.preventDefault()
    const { error } = await supabase.rpc('comm_signaler', { p_id: signalement.m.id, p_raison: signalement.raison })
    setSignalement(error ? { ...signalement, erreur: error.message } : { ...signalement, fait: true })
  }

  async function ouvrirFil(m) {
    setFil(m)
    setFilMessages([])
    const { data } = await supabase.from('comm_messages').select(COLONNES).eq('parent_id', m.id).order('created_at')
    setFilMessages(data || [])
    chargerReactions([m.id, ...(data || []).map((x) => x.id)])
  }

  async function ouvrirPrive(membreId) {
    const { data, error } = await supabase.rpc('comm_ouvrir_prive', { p_autre: membreId })
    if (error) { setErreur(error.message); return }
    setChoixMembre(false)
    setRecherche('')
    setTiroir(false)
    if (!prives.some((p) => p.conversation_id === data)) {
      setPrives((p) => [{ conversation_id: data, autre_id: membreId, non_lus: 0, dernier_message_le: new Date().toISOString() }, ...p])
    }
    setVue({ type: 'prive', id: data, autre: membreId })
  }

  function aller(v) {
    setVue(v)
    setTiroir(false)
  }

  /* ---------- Rendu ---------- */

  const peutPublier = vue?.type === 'prive' || admin || salon?.ecriture === 'tous'
  const listeEpingles = useMemo(() => messages.filter((m) => m.epingle && !m.supprime_le), [messages])
  const groupes = useMemo(() => regrouper(messages), [messages])

  const propsMessage = {
    membres, moi, admin,
    onReagir: reagir, onRepondre: ouvrirFil, onModifier: modifier,
    onSupprimer: supprimer, onEpingler: epingler,
    onSignaler: (m) => setSignalement({ m, raison: '' }),
  }

  if (chargement) return <div className="cm-attente">Chargement de la communauté...</div>
  if (profile?.communaute_bloque) {
    return <div className="cm-attente">Ton accès à la communauté est suspendu. Écris à Jérôme sur WhatsApp si tu penses que c'est une erreur.</div>
  }

  const titre = vue?.type === 'salon' ? `# ${salon?.nom || ''}` : nomAffiche(autre)

  return (
    <div className={`cm ${fil ? 'cm--fil' : ''}`}>
      {apercu && (
        <div className="cm-apercu">
          Aperçu admin : les élèves voient encore Discord. Tu bascules dans Admin, partie Communauté.
        </div>
      )}

      {/* ---------- Barre laterale ---------- */}
      <aside className={`cm-cote ${tiroir ? 'is-ouvert' : ''}`} aria-label="Salons et messages privés">
        <div className="cm-cote-titre">Loops <em>//</em> Play</div>

        {CATEGORIES.map((c) => {
          const sl = salons.filter((s) => s.categorie === c.cle)
          if (!sl.length) return null
          return (
            <div key={c.cle} className="cm-groupe">
              <p className="cm-groupe-titre">{c.label}</p>
              {sl.map((s) => {
                const n = nonLus[s.id] || 0
                const actif = vue?.type === 'salon' && vue.id === s.id
                return (
                  <button key={s.id} type="button" className={`cm-salon ${actif ? 'is-actif' : ''} ${n ? 'is-nonlu' : ''}`}
                    onClick={() => aller({ type: 'salon', id: s.id })}>
                    <span className="cm-dieze">#</span>{s.nom}
                    {s.ecriture === 'moderateurs' && <span className="cm-cadenas" title="Seul Jérôme publie ici">🔒</span>}
                    {n > 0 && !actif && <span className="cm-compteur">{n > 99 ? '99+' : n}</span>}
                  </button>
                )
              })}
            </div>
          )
        })}

        <div className="cm-groupe">
          <p className="cm-groupe-titre">
            Messages privés
            <button type="button" className="cm-plus" aria-label="Nouveau message privé" title="Nouveau message privé"
              onClick={() => setChoixMembre(true)}>+</button>
          </p>
          {prives.length === 0 && <p className="cm-vide-petit">Aucune conversation.</p>}
          {prives.map((p) => {
            const mb = membres[p.autre_id]
            const actif = vue?.type === 'prive' && vue.id === p.conversation_id
            return (
              <button key={p.conversation_id} type="button"
                className={`cm-salon cm-salon--prive ${actif ? 'is-actif' : ''} ${p.non_lus ? 'is-nonlu' : ''}`}
                onClick={() => aller({ type: 'prive', id: p.conversation_id, autre: p.autre_id })}>
                <Avatar membre={mb} taille={22} />{nomAffiche(mb)}
                {p.non_lus > 0 && !actif && <span className="cm-compteur">{p.non_lus}</span>}
              </button>
            )
          })}
        </div>
      </aside>
      {tiroir && <div className="cm-voile" onClick={() => setTiroir(false)} aria-hidden="true" />}

      {/* ---------- Colonne principale ---------- */}
      <section className="cm-centre" aria-label={titre}>
        <header className="cm-entete">
          <button type="button" className="cm-burger" aria-label="Salons" onClick={() => setTiroir(true)}>☰</button>
          <div className="cm-entete-titre">
            <h2>{titre}</h2>
            {salon?.description && <p>{salon.description}</p>}
            {vue?.type === 'prive' && <p>Conversation privée</p>}
          </div>
          {vue?.type === 'salon' && listeEpingles.length > 0 && (
            <button type="button" className={`cm-bouton-epingles ${epingles ? 'is-actif' : ''}`} onClick={() => setEpingles(!epingles)}>
              📌 {listeEpingles.length}
            </button>
          )}
        </header>

        {erreur && <p className="cm-erreur cm-erreur--haut" onClick={() => setErreur(null)}>{erreur}</p>}

        {epingles && (
          <div className="cm-epingles">
            <p className="cm-epingles-titre">Messages épinglés</p>
            {listeEpingles.map((m) => (
              <Message key={m.id} m={m} reactions={reactions[m.id]} {...propsMessage} />
            ))}
          </div>
        )}

        <div className="cm-liste" ref={liste} onScroll={surDefilement}>
          {plusAncien && (
            <button type="button" className="cm-plus-ancien" onClick={() => { collerEnBas.current = false; chargerVue(vue, messages[0]?.created_at) }}>
              Messages plus anciens
            </button>
          )}
          {messages.length === 0 && (
            <div className="cm-bienvenue">
              {vue?.type === 'salon'
                ? <><h3>Bienvenue dans #{salon?.nom}</h3><p>{salon?.ecriture === 'moderateurs' ? 'Jérôme publie ici. Tu peux répondre en fil sous chaque message.' : 'Personne n\'a encore écrit ici. Lance la discussion.'}</p></>
                : <><h3>Toi et {nomAffiche(autre)}</h3><p>Seuls vous deux voyez cette conversation.</p></>}
            </div>
          )}
          {groupes.map(({ m, suite, jourChange }) => (
            <div key={m.id}>
              {jourChange && <div className="cm-jour"><span>{jourSeparateur(m.created_at)}</span></div>}
              <Message m={m} continuation={suite} reactions={reactions[m.id]} {...propsMessage} />
            </div>
          ))}
        </div>

        <Composer
          key={vue?.id}
          membres={membres}
          moi={moi}
          placeholder={vue?.type === 'salon' ? `Écrire dans #${salon?.nom || ''}` : `Écrire à ${nomAffiche(autre)}`}
          desactive={!peutPublier}
          messageDesactive="Seul Jérôme publie dans ce salon. Tu peux répondre en fil sous un message (bouton ↩)."
          onEnvoyer={(c) => envoyer(c)}
        />
      </section>

      {/* ---------- Fil de reponses ---------- */}
      {fil && (
        <aside className="cm-panneau-fil" aria-label="Fil de réponses">
          <header className="cm-entete">
            <div className="cm-entete-titre"><h2>Fil</h2><p>{titre}</p></div>
            <button type="button" className="cm-fermer" aria-label="Fermer le fil" onClick={() => setFil(null)}>×</button>
          </header>
          <div className="cm-liste cm-liste--fil">
            <Message m={fil} reactions={reactions[fil.id]} dansFil {...propsMessage} />
            <div className="cm-jour"><span>{filMessages.length} réponse{filMessages.length > 1 ? 's' : ''}</span></div>
            {regrouper(filMessages).map(({ m, suite }) => (
              <Message key={m.id} m={m} continuation={suite} reactions={reactions[m.id]} dansFil {...propsMessage} />
            ))}
          </div>
          <Composer
            key={'fil-' + fil.id}
            membres={membres}
            moi={moi}
            placeholder="Répondre dans le fil"
            onEnvoyer={(c) => envoyer(c, fil)}
          />
        </aside>
      )}

      {/* ---------- Choix d'un membre ---------- */}
      {choixMembre && (
        <div className="cm-modale" role="dialog" aria-modal="true" aria-label="Nouveau message privé" onClick={() => setChoixMembre(false)}>
          <div className="cm-modale-boite" onClick={(e) => e.stopPropagation()}>
            <h3>Nouveau message privé</h3>
            <input type="search" placeholder="Chercher un membre" value={recherche} autoFocus
              onChange={(e) => setRecherche(e.target.value)} />
            <ul className="cm-membres">
              {Object.values(membres)
                .filter((m) => m.id !== moi && nomAffiche(m).toLowerCase().includes(recherche.toLowerCase()))
                .map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => ouvrirPrive(m.id)}>
                      <Avatar membre={m} taille={30} /> {nomAffiche(m)}
                      {m.moderateur && <span className="cm-badge">Équipe</span>}
                    </button>
                  </li>
                ))}
            </ul>
            <button type="button" className="cm-lien" onClick={() => setChoixMembre(false)}>Fermer</button>
          </div>
        </div>
      )}

      {/* ---------- Signalement ---------- */}
      {signalement && (
        <div className="cm-modale" role="dialog" aria-modal="true" aria-label="Signaler un message" onClick={() => setSignalement(null)}>
          <form className="cm-modale-boite" onClick={(e) => e.stopPropagation()} onSubmit={envoyerSignalement}>
            <h3>Signaler à Jérôme</h3>
            {signalement.fait ? (
              <>
                <p>Merci, Jérôme a reçu ton signalement. Il s'en occupe.</p>
                <button type="button" className="cm-bouton" onClick={() => setSignalement(null)}>Fermer</button>
              </>
            ) : (
              <>
                <p className="cm-extrait">« {signalement.m.contenu?.slice(0, 200) || signalement.m.fichier_nom} »</p>
                <textarea rows={3} placeholder="Ce qui ne va pas (facultatif)" value={signalement.raison}
                  onChange={(e) => setSignalement({ ...signalement, raison: e.target.value })} />
                {signalement.erreur && <p className="cm-erreur">{signalement.erreur}</p>}
                <div className="cm-modale-actions">
                  <button type="submit" className="cm-bouton">Envoyer le signalement</button>
                  <button type="button" className="cm-lien" onClick={() => setSignalement(null)}>Annuler</button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
