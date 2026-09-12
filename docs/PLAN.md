# RețetaMea — Plan de dezvoltare

> „Facebook pentru rețete": rețea socială mobilă, centrată exclusiv pe mâncare.
> Trei etape, fiecare cu livrabil funcțional și criterii clare de finalizare.

---

## 0. Decizii tehnice fixate înainte de prima linie de cod

### Stack

| Componentă | Tehnologie | De ce |
|---|---|---|
| Mobile | React Native + Expo (SDK 54+), expo-router | Un singur cod pentru iOS + Android, build în cloud cu EAS |
| Backend | Node.js + NestJS | Structură modulară impusă, DI, validare, ușor de întreținut |
| ORM | Prisma | Migrații versionate, tipuri generate automat |
| DB | Neon PostgreSQL | Serverless, free tier, branching pentru dev/prod |
| Imagini | Supabase Storage | Bucket public creat automat, 1 GB free, integrat cu restul stack-ului (schimbat din R2 — vezi nota de mai jos) |
| Procesare imagini | Sharp (server) + expo-image-manipulator (client) | Resize în două trepte |
| Auth | JWT access + refresh token rotativ | Standard, fără dependențe externe la MVP |
| API | REST + OpenAPI (Swagger generat de NestJS) | Simplu și suficient; GraphQL nu aduce nimic aici |
| State mobil | TanStack Query + Zustand | Cache, refetch, infinite scroll gratuit |
| Deploy API | Render | Ales pentru găzduirea reală (vezi 2.7); container simplu, cost aproape zero la început |

### Nouă decizii care modifică modelul propus inițial

Le fixăm acum pentru că fiecare e scumpă de schimbat mai târziu:

1. **`recipe_images` ca tabel separat, nu `image_url` pe `recipes`.** Ai spus „max 5 imagini/post" — dacă începem cu o coloană unică, migrarea ulterioară atinge feed-ul, editorul și toate query-urile. Tabel separat de la început, chiar dacă UI-ul afișează inițial o singură imagine.

2. **În DB salvăm *object key*, nu URL complet.** `recipes/123/a1b2c3.jpg`, nu `https://cdn.../recipes/...`. URL-ul se construiește în backend din `R2_PUBLIC_BASE`. Poți schimba domeniul sau CDN-ul fără nicio migrare.

3. **Resize în două trepte.** Telefonul reduce înainte de upload (max 1600px, JPEG q80 → ~300–500 KB), serverul regenerează cu Sharp trei variante: `thumb` 400px, `feed` 1080px, `full` 1600px. Nu urcăm niciodată 15 MB pe rețeaua mobilă a utilizatorului și nu blocăm event loop-ul backendului cu fișiere mari.

4. **Regula anti-postare-goală.** Toate câmpurile rețetei rămân opționale, dar validăm: cel puțin unul dintre **imagine**, **titlu**, **descriere** trebuie completat. Altfel feed-ul se umple cu postări goale și nu ai ce afișa în card. Este singura obiecție reală la modelul „totul opțional" — restul flexibilității e corectă și o păstrăm.

5. **Paginare cursor-based peste tot.** `?cursor=<created_at>_<id>&limit=20`, nu `offset/limit`. La feed cu conținut nou, offset-ul duplică și sare postări.

6. **Contoare denormalizate** pe `recipes`: `likes_count`, `comments_count`, `saves_count`, actualizate în aceeași tranzacție cu acțiunea. Altfel fiecare card din feed declanșează trei `COUNT(*)`.

7. **Soft delete** (`deleted_at`) pentru rețete și comentarii. Necesar pentru moderare și pentru „undo" în etapa 3.

8. **`users.id` de tip UUID**, nu autoincrement. Nu expune numărul de utilizatori și permite generare client-side pentru idempotență la upload.

9. **Monorepo cu npm workspaces**, `shared/` pentru tipuri și scheme Zod comune între mobil și backend. Un singur loc unde e definită forma unei rețete.

### Structura repo

```
RetetaMea/
├── mobile/                 # Expo app
│   ├── app/                # expo-router (file-based routing)
│   ├── components/
│   ├── features/           # feed/, recipe/, auth/, profile/
│   ├── lib/                # api client, storage, image
│   └── theme/
├── backend/
│   ├── src/
│   │   ├── auth/  users/  recipes/  uploads/
│   │   ├── social/         # likes, comments, follows, saves
│   │   ├── search/  feed/  notifications/  moderation/
│   │   └── common/         # guards, filters, pipes, pagination
│   ├── prisma/
│   └── test/
├── shared/                 # tipuri + scheme Zod
└── docs/
```

---

# ETAPA 1 — Fundația și MVP-ul „single-player"

**Obiectiv:** un utilizator își face cont, publică o rețetă cu poză și vede rețetele tuturor într-un feed cronologic. Fără like, fără comentarii, fără follow.

**De ce așa:** partea socială nu are sens până când nu există conținut și nu poți publica fiabil. Etapa 1 dovedește lanțul complet telefon → API → R2 → DB → feed, care e partea cu cel mai mare risc tehnic.

**Efort estimat:** 3–5 săptămâni part-time.

## 1.1 Infrastructură

- [x] Repo GitHub, monorepo npm workspaces, `.gitignore`, `.env.example`
- [x] Proiect Neon, baza `foodbook`, migrații Prisma aplicate
- [ ] Al doilea branch DB pentru `dev`, separat de `main`
- [x] Bucket `foodbook-media` pe Supabase Storage, public, creat automat la pornire (schimbat din planul inițial cu Cloudflare R2 — vezi nota de la finalul Etapei 2)
- [x] Backend NestJS: config module, Prisma module, health check `/health`
- [x] Expo app cu expo-router, splash screen, icon placeholder
- [x] CI GitHub Actions: lint + typecheck + build + bundle mobil la fiecare PR
- [ ] Suita e2e în CI (cere DB și API pornit; deocamdată se rulează local cu `npm run test:e2e`)

## 1.2 Schema bazei de date (Etapa 1)

```
users
  id              uuid pk
  username        text unique        -- handle: @maria
  display_name    text
  email           citext unique
  password_hash   text
  avatar_key      text null
  bio             text null
  created_at      timestamptz
  updated_at      timestamptz

refresh_tokens
  id              uuid pk
  user_id         uuid fk -> users
  token_hash      text               -- niciodată tokenul în clar
  expires_at      timestamptz
  revoked_at      timestamptz null
  device_info     text null

recipes
  id              uuid pk
  user_id         uuid fk -> users
  title           text null
  description     text null
  prep_minutes    int null
  servings        int null
  likes_count     int default 0      -- pregătite pentru etapa 2
  comments_count  int default 0
  saves_count     int default 0
  created_at      timestamptz
  updated_at      timestamptz
  deleted_at      timestamptz null
  INDEX (created_at DESC, id DESC)
  INDEX (user_id, created_at DESC)

recipe_images
  id              uuid pk
  recipe_id       uuid fk -> recipes on delete cascade
  object_key      text               -- recipes/<recipe_id>/<hash>.jpg
  width           int
  height          int
  position        int                -- 0 = imagine principală
  UNIQUE (recipe_id, position)

ingredients
  id              uuid pk
  recipe_id       uuid fk -> recipes on delete cascade
  name            text
  quantity        numeric null
  unit            text null
  position        int

instructions
  id              uuid pk
  recipe_id       uuid fk -> recipes on delete cascade
  step_number     int
  text            text
```

Instrucțiunile ca tabel separat, nu text liber: în etapa 3 vrei „pas cu pas" cu timer și AI care structurează rețeta. Un `text` monolit ar trebui reparsat.

## 1.3 API-uri

```
POST   /auth/register          { username, displayName, email, password }
POST   /auth/login             { email, password }  -> { accessToken, refreshToken }
POST   /auth/refresh           { refreshToken }     -> rotire token
POST   /auth/logout
GET    /me

PATCH  /me                     { displayName?, bio? }
POST   /me/avatar              multipart -> avatar_key
GET    /users/:username
GET    /users/:username/recipes?cursor=

POST   /uploads/image          multipart, max 8 MB -> { key, width, height }
POST   /recipes                { title?, description?, imageKeys[], ingredients[],
                                 instructions[], prepMinutes?, servings? }
GET    /recipes/:id
PATCH  /recipes/:id            (doar autorul)
DELETE /recipes/:id            (soft delete, doar autorul)

GET    /feed?cursor=           feed cronologic global
```

**Fluxul de upload:** clientul redimensionează → `POST /uploads/image` → backendul validează magic bytes (nu extensia), rulează Sharp, scrie 3 variante în R2, întoarce cheia → clientul trimite `imageKeys` la `POST /recipes`. Imaginile orfane (upload fără rețetă creată) se șterg cu un job zilnic.

## 1.4 Ecrane mobile

| Ecran | Conținut |
|---|---|
| Onboarding | Logo, „Intră în cont" / „Creează cont" |
| Register / Login | Formulare cu validare, erori inline |
| Feed (tab Acasă) | Listă cronologică, infinite scroll, pull-to-refresh, skeleton la încărcare |
| Creare rețetă (tab ➕) | Titlu, poză, descriere, ingrediente dinamice, pași, timp, porții |
| Detaliu rețetă | Imagine mare, autor, descriere, ingrediente, pași |
| Profil propriu (tab 👤) | Avatar, nume, bio, grid rețete, editare profil, logout |
| Profil public | Același layout, fără editare |

Bara de tab-uri are 5 poziții de la început (Acasă, Caută, ➕, Salvate, Profil); în etapa 1, „Caută" și „Salvate" afișează un empty state onest („Disponibil în curând"). Așa nu rescrii navigația la etapa 2.

## 1.5 Definiția de „gata" pentru Etapa 1

- Instalez aplicația pe un telefon real (build EAS preview), îmi fac cont, public o rețetă cu poză făcută pe loc, iar un al doilea telefon o vede în feed în mai puțin de 2 secunde.
- Imaginea ajunsă în R2 are sub 500 KB și trei variante.
- Tokenul de acces expiră la 15 minute și se reîmprospătează transparent, fără să fiu delogat.
- Închid și redeschid aplicația — rămân logat (expo-secure-store).
- Feed-ul se scrollează la 100 de rețete fără să scadă sub 55 fps.

## 1.6 Explicit *în afara* etapei 1

Like, comentarii, follow, salvare, căutare, categorii, notificări, Google/Apple login, resetare parolă.

---

# ETAPA 2 — Rețeaua socială și descoperirea ✅ COMPLETĂ

**Obiectiv:** aplicația devine „multi-player". Interacționezi cu ceilalți și găsești conținut fără să depinzi de ordinea cronologică.

**Status:** implementată și verificată — 97/97 teste e2e, lint și typecheck curate pe tot monorepo-ul.

### Trei devieri deliberate față de schița inițială

1. **Categorie unică per rețetă, nu many-to-many.** Tabelul `recipe_categories` din schiță a fost înlocuit cu o coloană `category_id` nullable direct pe `recipes`. O rețetă cu o singură categorie e suficientă pentru descoperire (așa fac majoritatea aplicațiilor de rețete) și simplifică formularul de creare — fără checkbox-uri multiple.
2. **Hashtag-uri (`tags`/`recipe_tags`) amânate.** Categoriile fixe acoperă nevoia principală de descoperire pentru MVP; tag-urile libere rămân pentru o iterație viitoare.
3. **Căutare cu `ILIKE` + `unaccent`, nu `tsvector`/GIN.** Modelarea unei coloane generate `tsvector` în Prisma (`Unsupported` + index Gin) e fragilă și riscă drift la migrații viitoare fără `previewFeatures` suplimentare. La volumul așteptat (câteva mii de rețete), un scan secvențial cu `unaccent()` e suficient de rapid. Rămâne o optimizare de luat în calcul când tabelul crește mult.

**Notificări push** nu sunt implementate — necesită un development build (Expo Go nu mai suportă push remote din SDK-urile recente); ecranul de notificări funcționează cu polling la 30s cât timp aplicația e deschisă. Rămâne pentru momentul în care există un development build (Etapa 3 sau un pas intermediar).

## 2.1 Schema adăugată

```
recipe_likes
  user_id    uuid fk
  recipe_id  uuid fk
  created_at timestamptz
  PRIMARY KEY (user_id, recipe_id)          -- previne like-uri duplicate
  INDEX (recipe_id)

comments
  id                uuid pk
  recipe_id         uuid fk
  user_id           uuid fk
  parent_comment_id uuid null fk -> comments   -- pregătit pentru răspunsuri
  content           text
  created_at        timestamptz
  updated_at        timestamptz
  deleted_at        timestamptz null
  INDEX (recipe_id, created_at DESC)

follows
  follower_id  uuid fk
  following_id uuid fk
  created_at   timestamptz
  PRIMARY KEY (follower_id, following_id)
  CHECK (follower_id <> following_id)        -- nu te urmărești singur
  INDEX (following_id)

saved_recipes
  user_id    uuid fk
  recipe_id  uuid fk
  created_at timestamptz
  PRIMARY KEY (user_id, recipe_id)

categories
  id    serial pk
  slug  text unique      -- mic-dejun, paste, deserturi...
  name  text
  emoji text

-- pe recipes: category_id int null fk -> categories (o singura categorie,
-- nu many-to-many - vezi "Trei devieri deliberate" de mai sus)

-- tags / recipe_tags: AMANATE, nu implementate in Etapa 2

notifications
  id         uuid pk
  user_id    uuid fk         -- destinatarul
  actor_id   uuid fk         -- cine a produs evenimentul
  type       text            -- like | comment | follow
  recipe_id  uuid null
  comment_id uuid null
  read_at    timestamptz null
  created_at timestamptz
  INDEX (user_id, created_at DESC)

-- adăugate pe users:
  followers_count int default 0
  following_count int default 0
  recipes_count   int default 0
```

## 2.2 Căutare

**Implementat**: `ILIKE` + `unaccent`, nu `tsvector`/GIN (vezi devierea #3 de mai sus).

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;   -- „ciorba" găsește „ciorbă"

-- exemplu (SQL brut, parametrizat prin Prisma.sql, nu string concatenation):
SELECT id, created_at FROM recipes
WHERE deleted_at IS NULL
  AND (unaccent(lower(title)) LIKE unaccent(lower($1))
       OR unaccent(lower(description)) LIKE unaccent(lower($1)))
ORDER BY created_at DESC, id DESC
```

Aceeași tehnică pentru căutarea de utilizatori (`username`, `display_name`). Prisma nu știe să apeleze `unaccent()` din query builder-ul obișnuit, de-asta filtrarea e în SQL brut — dar rezultatele finale se încarcă tot prin Prisma (`findMany({ where: { id: { in: ids } } })`), ca să beneficieze de aceleași `include`-uri ca restul aplicației.

## 2.3 API-uri implementate

```
POST/DELETE /recipes/:id/like          -> { likesCount }         (200, idempotent)
POST/DELETE /recipes/:id/save          -> { savesCount }         (200, idempotent)
GET  /me/saved?cursor=

GET  /recipes/:id/comments?cursor=
POST /recipes/:id/comments             { content, parentCommentId? }  -- un singur nivel de raspuns
DELETE /comments/:id                   -- doar autorul

POST/DELETE /users/:username/follow    -> 204 (idempotent, nu te poti urmari singur -> 400)
GET  /users/:username/followers?cursor=
GET  /users/:username/following?cursor=

GET  /feed?scope=all|following|discover&cursor=
GET  /search/recipes?q=&cursor=
GET  /search/users?q=&cursor=
GET  /categories
GET  /categories/:slug/recipes?cursor=

GET  /notifications?cursor=
GET  /notifications/unread-count
POST /notifications/read
```

**Feed „following":** rețetele autorilor urmăriți, cronologic; gol dacă nu urmărești pe nimeni (UI propune "Caută utilizatori").
**Feed „discover":** scor simplu, fără machine learning —
`scor = log(1 + likes*3 + comments*5 + saves*4) − ore_de_la_publicare / 12`, calculat în SQL brut, limitat la ultimele 30 de zile. Paginat prin **offset**, nu cursor — singura excepție de la regula generală: scorul se schimbă în timp (nu e monoton), deci un cursor keyset pe o ordine care nu e stabilă nu are sens. Documentat explicit în cod.

**N+1 evitat:** „am dat like / am salvat?" pentru o pagină întreagă se calculează cu **două query-uri în plus TOTAL** (`WHERE recipe_id IN (...)`), nu un `LEFT JOIN` per rând cum era schițat inițial — echivalent ca număr de round-trip-uri, mai simplu de întreținut în Prisma (`ViewerFlagsService`).

## 2.4 Ecrane implementate

- **Card de feed**: ❤️ / 💬 / 🔖 cu optimistic update (haptic feedback la apăsare, rollback automat dacă cererea eșuează) — actualizează simultan toate cache-urile unde apare acea rețetă (feed, profil, salvate, căutare, categorie), nu doar ecranul curent
- **Ecran comentarii** (`recipe/[id]/comments`, prezentare modală): listă plată ordonată cronologic invers, un singur nivel de răspuns marcat vizual cu „↳ răspuns" (nu threading complet — pagina de comentarii nu garantează că un răspuns apare lângă părinte, e un compromis documentat)
- **Editare rețetă** (`recipe/[id]/edit`): formular comun cu crearea (`RecipeForm`), reface starea completă inclusiv imaginile păstrate (cheia imaginii e acum expusă în `RecipeImage.key`)
- **Tab Caută**: bară de căutare cu debounce, taburi Rețete/Utilizatori, grid de categorii când căutarea e goală
- **Tab Salvate**: listă reală (nu mai e placeholder)
- **Profil propriu și profil public**: buton Urmărește, contoare followers/following tappable → liste dedicate
- **Ecran notificări**: clopoțel cu un badge roșu (număr necitite), polling la 30s — fără push (vezi mai sus)
- **Feed cu control segmentat**: Toate / Urmăriți / Descoperă, ca tab-uri în interiorul ecranului Acasă (nu tab-uri separate în bara de jos)

## 2.5 Polish UI/UX

Loading skeletons, empty states cu mesaj + acțiune, error states cu buton de reîncercare — toate erau deja în Etapa 1 și au fost reutilizate. Haptics la like adăugat în Etapa 2. Tranziția shared-element și tema întunecată automată (deja suportată din tema Etapei 1 prin `useColorScheme`) rămân opționale, neimplementate explicit ca animație dedicată.

## 2.6 Verificare

97 de verificări automate (`npm run test:e2e`) acoperă: like/unlike idempotent, comentarii cu un nivel de răspuns, follow/unfollow cu regula anti-auto-urmărire, salvare, categorii (inclusiv slug invalid → 400), cele trei scope-uri de feed, căutare cu și fără diacritice, notificări (inclusiv „nu te notifici singur”), și editarea categoriei pe o rețetă existentă.

## 2.7 Adăugiri ulterioare (după finalizarea etapei)

- **Vizualizare pe tot ecranul a pozelor** din pagina de rețetă (`ImageViewer`), cu swipe între poze și pinch-zoom nativ (doar iOS).
- **Feed cu paginare pe buton**, nu scroll infinit: primele 10 rețete, apoi „Încarcă mai multe" la cerere.
- **Doi bug-uri de expo-router/React Native corectate**: stiluri de tip array pasate direct unui copil `<Link asChild>` (Slot-ul nu le acceptă — necesită `StyleSheet.flatten`), și `numColumns` schimbat la runtime pe același `FlatList` refolosit între grila de categorii și lista de rezultate din ecranul de căutare (necesită `key` distinct ca să forțeze remount).
- **Storage mutat de la Cloudflare R2 la Supabase Storage** (decizie explicită, nu doar implementarea R2 amânată din 1.1): un singur provider de întreținut pentru storage, alături de baza de date Neon — mai puține conturi/secrete separate. Bucket-ul se creează automat, public, la pornirea backendului dacă nu există deja. Cheia folosită e cea „secret" (service role), nu „publishable" — backendul e de încredere și nu are nevoie de reguli RLS.
- **EXIF/GPS confirmat eliminat**: pipeline-ul din Etapa 1 (Sharp, fără `withMetadata()`) elimina deja metadatele — verificat explicit acum cu o imagine de test cu bloc EXIF/GPS injectat manual.
- **Rate limiting de bază** (`@nestjs/throttler`): plafon implicit 120 cereri/minut, plus limite specifice — 5 înregistrări/oră/IP, 10 rețete/zi/utilizator, 60 comentarii/oră/utilizator, 20 upload-uri/oră/utilizator (urmărite după utilizator autentificat, nu IP, ca să nu penalizeze o rețea partajată). Activ doar cu `NODE_ENV=production`, ca dezvoltarea locală și suita e2e să nu fie blocate de propriile limite.
- **Backend găzduit pe Render, sursele pe GitHub** (`github.com/UtaMarian/foodbook`) — necesar pentru un deploy accesibil din afara rețelei locale, nu doar pentru dezvoltare.

---

# ETAPA 3 — Producție: securitate, moderare, lansare, AI

**Obiectiv:** aplicația poate fi lăsată pe mâna unor străini și publicată în magazine.

**Efort estimat:** 4–6 săptămâni, plus 1–2 săptămâni de așteptare pentru aprobarea în App Store.

## 3.1 Securitate (obligatoriu înainte de lansare)

- [x] Validare strictă a tuturor DTO-urilor — deja acoperit prin Zod pe fiecare rută (nu class-validator, dar același efect: `ZodValidationPipe` respinge orice câmp neașteptat)
- [x] Rate limiting per IP **și** per utilizator: 5 înregistrări/oră/IP, 10 rețete/zi, 60 comentarii/oră, 20 upload-uri/oră (vezi 2.7)
- [x] Validare upload: magic bytes, max 8 MB, max 5 imagini/rețetă, ștergerea EXIF (**GPS-ul din poze e o scurgere a adresei de domiciliu**) — toate patru erau deja implementate din Etapa 1; EXIF confirmat explicit acum (vezi 2.7)
- [x] Guard de proprietate: editezi/ștergi doar ce e al tău — testat explicit în suita e2e (secțiunile 6 și 14)
- [ ] Helmet, CORS restrâns, secrete doar din variabile de mediu
- [ ] Parole cu Argon2id; verificare împotriva listei de parole compromise
- [ ] Mesaje de eroare identice la login greșit (nu divulga dacă emailul există)
- [ ] `npm audit` + Dependabot în CI
- [ ] Backup: PITR activat pe Neon, verificat cu o restaurare reală

## 3.2 Moderare și siguranță (cerință de magazin)

Apple respinge aplicațiile cu conținut generat de utilizatori care nu au raportare, blocare, ștergere de cont și termeni de utilizare. Nu e opțional.

```
reports      id, reporter_id, target_type (recipe|comment|user), target_id, reason, status, created_at
user_blocks  blocker_id, blocked_id, created_at
```

- [ ] `POST /reports`, buton de raportare pe rețetă / comentariu / profil
- [ ] Blocare utilizator (dispare din feed, căutare și comentarii, în ambele sensuri)
- [ ] Ștergere cont cu anonimizare, direct din aplicație (cerință Apple + GDPR)
- [ ] Panou intern de moderare (poate fi o pagină web simplă protejată cu rol `admin`)
- [ ] Politică de confidențialitate + Termeni, găzduite public, cu link în aplicație

## 3.3 Performanță și observabilitate

- [ ] Sentry pe mobil și pe backend
- [ ] Logging structurat (pino) cu request id
- [ ] Cache pe feed-ul „discover" (Redis sau in-memory, TTL 60 s)
- [ ] `EXPLAIN ANALYZE` pe toate query-urile de listare; indecși verificați
- [x] Ștergerea variantelor orfane — `npm run cleanup:orphans`, deja implementat (Etapa 1), portat pe Supabase Storage în 2.7
- [ ] Limite de cost: alertă când Supabase Storage se apropie de plafonul free (1 GB) sau Neon se apropie de limita free

## 3.4 Lansare

- [ ] EAS Build production + EAS Submit
- [ ] Cont Apple Developer (99 USD/an) și Google Play Console (25 USD, o singură dată)
- [ ] Icoane, splash, capturi de ecran pentru ambele magazine
- [ ] Backend pe domeniu propriu cu HTTPS, environment `production` separat de `dev`
- [ ] Versionare API (`/v1`) și ecran „actualizare obligatorie" pentru clienți vechi
- [ ] Beta închis: TestFlight + Google Play internal testing, 10–20 persoane, două săptămâni

## 3.5 Funcții AI (după lansare, nu înainte)

Se sprijină pe date reale, deci vin la final:

1. **„Ce pot găti?"** — utilizatorul introduce ingredientele din frigider, aplicația caută rețete compatibile. Prima versiune nu are nevoie de AI: potrivire pe tabelul `ingredients` cu normalizarea numelor, sortare după procentul de ingrediente acoperite. Ieftin și predictibil.
2. **Asistent conversațional** — „am pui, orez și ardei" → sugestii, folosind Claude API peste rețetele existente din bază (RAG), ca să recomande conținut real din aplicație, nu inventat.
3. **Structurare automată** — utilizatorul lipește un text liber, AI-ul îl transformă în titlu + ingrediente + pași, pe care utilizatorul îi confirmă înainte de publicare. Reduce cel mai mare obstacol la postare.

Pentru toate trei: buget de tokenuri per utilizator, rezultate marcate ca generate cu AI și **întotdeauna** confirmare umană înainte de salvare.

## 3.6 Definiția de „gata" pentru Etapa 3

- Aplicația e live în ambele magazine.
- Un raport de conținut abuziv ajunge la moderator în sub un minut și poate fi rezolvat din panou.
- Un utilizator își poate șterge contul complet din aplicație.
- Un test de încărcare cu 100 de utilizatori simultani nu depășește 500 ms la p95 pe feed.

---

## Anexa A — Variabile de mediu

```
DATABASE_URL=postgresql://...neon.tech/retetamea
JWT_ACCESS_SECRET=        JWT_ACCESS_TTL=15m
JWT_REFRESH_SECRET=       JWT_REFRESH_TTL=30d
SUPABASE_URL=             SUPABASE_SECRET_KEY=
SUPABASE_BUCKET=foodbook-media
MAX_IMAGE_BYTES=8388608   MAX_IMAGES_PER_RECIPE=5
```

## Anexa B — Costuri

| Etapă | Cost lunar |
|---|---|
| 1 și 2 (dezvoltare) | ~0 EUR — Neon free, Supabase Storage free (1 GB), Railway/Render hobby/trial |
| 3 (lansare) | ~5–20 EUR/lună backend + 99 USD/an Apple + 25 USD o dată Google |
| Creștere | Supabase Storage peste 1 GB necesită planul Pro sau facturare suplimentară — verifică pricing-ul curent înainte de lansare |

Free tier nu înseamnă nelimitat: limitele de upload din 3.1 sunt cele care țin costul sub control.

## Anexa C — Riscuri

| Risc | Măsură |
|---|---|
| Feed gol la lansare | Seed cu 50–100 rețete proprii înainte de beta |
| Respingere App Store pentru UGC | Moderarea din 3.2 făcută integral, nu parțial |
| Costuri de storage explodate de abuz | Limite per utilizator din prima zi a etapei 1 |
| Blocaj la partea AI | Etapa 3.5 e opțională; aplicația e completă și fără ea |
