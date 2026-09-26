import { useInstallation } from '../lib/installation'
import '../styles/installer.css'

/**
 * Page « Installe l'appli » : /backstage/installer
 * Le lien a envoyer aux eleves sur WhatsApp. Elle s'adapte au telephone.
 */

function IconePartager() {
  return (
    <svg className="inst-picto" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-label="icône Partager">
      <path d="M12 3v12" /><polyline points="7 8 12 3 17 8" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  )
}

export default function Installer() {
  const { installee, peutProposer, installer, plateforme } = useInstallation()
  const url = `${window.location.origin}${import.meta.env.BASE_URL}`

  return (
    <div className="container inst">
      <header className="app-page-header">
        <p className="app-page-eyebrow">Appli</p>
        <h1 className="app-page-title">Le Backstage sur ton téléphone</h1>
        <p className="app-page-subtitle">
          Une icône Loops &amp; Play sur ton écran d'accueil : tu ouvres tes cours, ton calendrier et la communauté en un geste,
          en plein écran, comme une appli. Rien à télécharger sur un store, et c'est gratuit.
        </p>
      </header>

      <section className="inst-carte">
        <img className="inst-icone" src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="Icône Loops & Play" width="88" height="88" />

        {installee && (
          <p className="inst-ok">C'est installé : tu utilises déjà l'appli. Tu peux fermer cette page.</p>
        )}

        {!installee && plateforme === 'android' && (
          peutProposer ? (
            <>
              <button type="button" className="inst-bouton" onClick={installer}>Installer l'appli</button>
              <p className="inst-aide">Un clic, puis « Installer ». L'icône arrive sur ton écran d'accueil.</p>
            </>
          ) : (
            <ol className="inst-etapes">
              <li>Ouvre cette page dans <strong>Chrome</strong>.</li>
              <li>Touche le menu <strong>⋮</strong> en haut à droite.</li>
              <li>Choisis <strong>« Installer l'application »</strong> (ou « Ajouter à l'écran d'accueil »).</li>
            </ol>
          )
        )}

        {!installee && plateforme === 'ios' && (
          <ol className="inst-etapes">
            <li>Touche le bouton <strong>Partager</strong> <IconePartager /> en bas de Safari.</li>
            <li>Fais défiler et choisis <strong>« Sur l'écran d'accueil »</strong>.</li>
            <li>Touche <strong>« Ajouter »</strong> en haut à droite. C'est fait.</li>
          </ol>
        )}

        {!installee && plateforme === 'ios-autre' && (
          <>
            <p className="inst-aide">Sur iPhone, l'installation passe par <strong>Safari</strong>.</p>
            <ol className="inst-etapes">
              <li>Copie cette adresse : <strong>{url}</strong></li>
              <li>Ouvre-la dans <strong>Safari</strong>.</li>
              <li>Touche <strong>Partager</strong> <IconePartager />, puis <strong>« Sur l'écran d'accueil »</strong>.</li>
            </ol>
          </>
        )}

        {!installee && plateforme === 'ordinateur' && (
          <>
            <p className="inst-aide">
              C'est sur ton téléphone que l'appli prend tout son sens. Ouvre <strong>{url}</strong> sur ton téléphone,
              connecte-toi, puis va dans Dashboard, « Installer l'appli ».
            </p>
            {peutProposer && (
              <button type="button" className="inst-bouton inst-bouton--secondaire" onClick={installer}>L'installer aussi sur cet ordinateur</button>
            )}
          </>
        )}
      </section>

      <p className="inst-note">
        Tu te connectes une fois avec ton email et ton mot de passe, l'appli s'en souvient.
      </p>
      <a className="inst-lien" href={`${import.meta.env.BASE_URL}dashboard`}>Ouvrir le Backstage</a>
    </div>
  )
}
