# Espace adhérent — Loops & Play

App React + Vite pour l'espace privé des adhérents Loops & Play.
Auth, BDD et stockage gérés via **Supabase**. Stockage des sample packs sur **Google Drive**.

## Stack

- **Frontend** : React 18 + Vite + React Router
- **Auth** : Supabase Auth (email + mot de passe)
- **Base de données** : Supabase PostgreSQL
- **Stockage léger** (photos profil, covers) : Supabase Storage
- **Stockage lourd** (sample packs .zip, audio) : Google Drive
- **Styles** : CSS pur, aligné sur la charte du site principal

## Setup local (premier lancement)

### 1. Installer les dépendances

```bash
cd "C:/Users/loomy/Desktop/CC/Dj School - Loops & play/03_Production/espace-adherent"
npm install
```

### 2. Configurer Supabase

Copier `.env.example` vers `.env` :

```bash
cp .env.example .env
```

Puis remplir avec les vraies clés (Settings → API dans le dashboard Supabase) :

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 3. Lancer le serveur de dev

```bash
npm run dev
```

L'app s'ouvre automatiquement sur http://localhost:5173

## Structure du projet

```
espace-adherent/
├── public/
│   └── logo.png
├── src/
│   ├── main.jsx              ← Entry point
│   ├── App.jsx               ← Routes
│   ├── lib/
│   │   └── supabase.js       ← Client Supabase partagé
│   ├── pages/
│   │   ├── Login.jsx         ← /login
│   │   ├── Dashboard.jsx     ← /dashboard
│   │   ├── Formations.jsx    ← /formations
│   │   ├── Packs.jsx         ← /packs
│   │   ├── Profil.jsx        ← /profil
│   │   └── Admin.jsx         ← /admin
│   ├── components/           (à venir : Navbar, ProtectedRoute, etc.)
│   └── styles/
│       ├── global.css        ← Variables + reset + boutons globaux
│       └── login.css         ← Page login
├── .env.example              ← Template (à copier en .env)
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## Schéma base de données

À créer dans Supabase (SQL Editor) en Session 2. Tables :

- `profiles` (lié à `auth.users`) : nom, pseudo DJ, photo, bio, liens sociaux, pack
- `formations` : catalogue modules (titre, video_url, notion_url, pack_required)
- `ressources` : sample packs + sorties Ft. Low + presets (download_url Drive, stream_url Spotify/SC)
- `mix_adherents` : uploads de la communauté (statut : pending/approved/rejected)

Policies RLS (Row Level Security) à configurer :

- Profil : un user ne peut lire/modifier que SON profil. Admin peut tout.
- Formations : visible selon le `pack_required` du user.
- Ressources : visible à tout adhérent connecté.
- Mix : un user voit les approved + les siens, peu importe le statut.

## Roadmap par session

| Session | Livrable |
|---|---|
| ✅ 1 | Init projet + page Login UI + placeholders |
| ⏳ 2 | Auth Supabase branchée + routes protégées + page Profil |
| ⏳ 3 | Section Formations + Section Packs (lecture seule) |
| ⏳ 4 | Upload mix par adhérents + modération + Admin panel |
| ⏳ 5 | Polish + tests + déploiement |

## Déploiement

Le frontend se déploie n'importe où (Netlify, Vercel, Hostinger).

**Vercel** (recommandé pour React) :
1. Pousser le dossier sur un repo GitHub
2. "Import project" dans Vercel
3. Préfixer les variables d'env avec `VITE_` (Vercel les expose automatiquement)
4. Deploy

**Netlify** :
Idem, build command `npm run build`, publish directory `dist`.

**Hostinger** :
1. `npm run build` en local
2. Uploader le contenu de `dist/` dans un sous-domaine via FTP/File Manager
3. Configurer les variables d'env via fichier `.env.production` AVANT le build

## Sécurité

- ✅ La `anon key` Supabase est publique par design, exposée côté client.
- ✅ La sécurité repose sur les policies RLS PostgreSQL.
- ❌ **Ne JAMAIS exposer** la `service_role key` côté client.
- ⚠️ Les liens Google Drive sont accessibles avec l'URL : ne pas les partager hors espace adhérent.
- ✅ HTTPS forcé en production.
- ✅ Headers de sécurité à configurer selon l'hébergeur (CSP, etc.) en Session 5.

## RGPD

- Les données personnelles (profil) sont hébergées dans Supabase (région EU Frankfurt).
- À la livraison, le projet Supabase sera transféré à Jérôme (responsable de traitement).
- Une politique de confidentialité spécifique à l'espace adhérent sera à rédiger.
