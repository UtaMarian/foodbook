# FoodBook

Rețea socială pentru rețete — „Facebook pentru mâncare", construită mobile-first.

Monorepo: aplicație Expo (React Native), API NestJS, PostgreSQL pe Neon, imagini în Supabase Storage.
Planul complet pe etape este în [docs/PLAN.md](docs/PLAN.md).

**Status: Etapa 1 și Etapa 2 complete** — cont, profil, publicare/editare de rețete cu imagini, feed cronologic, plus like, comentarii, follow, salvare, categorii, căutare și notificări (fără push, vezi PLAN.md). 97 de teste e2e trec, lint și typecheck curate.
Moderare, securitate de producție și lansarea în magazine vin în Etapa 3.

---

## Structura

```
foodbook/
├── shared/     # scheme Zod + tipuri, folosite si de API si de aplicatie
├── backend/    # NestJS + Prisma + Supabase Storage
├── mobile/     # Expo + expo-router
└── docs/PLAN.md
```

`shared/` este sursa unică de adevăr pentru forma datelor: aceeași schemă validează formularul de pe telefon și body-ul din API, deci nu pot diverge.

## Cerințe

- **Node 22 LTS.** Node 25 funcționează, dar npm 12 emite un avertisment în stdout care sparge `create-expo-app` și alte unelte care parsează ieșirea npm.
- Un cont Neon (PostgreSQL). Supabase Storage e opțional în dezvoltare — vezi mai jos.

## Pornire

```bash
npm install
npm run build:shared          # backend si mobile importa shared din dist/

# Baza de date
cp backend/.env.example backend/.env   # completeaza DATABASE_URL, DIRECT_URL, secretele JWT
npm run db:generate -w @foodbook/backend
npx prisma migrate deploy --schema backend/prisma/schema.prisma

npm run seed                  # optional: 3 utilizatori si 6 retete demo
npm run dev:api               # http://localhost:3000/v1
npm run dev:mobile            # scaneaza codul QR cu Expo Go
```

Aplicația găsește singură API-ul: ia IP-ul din adresa serverului Metro, deci merge pe telefon fără configurare. Pentru alt backend, setează `EXPO_PUBLIC_API_URL`.

Cont demo după `npm run seed`: `maria_demo@foodbook.local` / `demo-parola-123`.

## Imaginile

În dezvoltare, dacă `SUPABASE_URL`/`SUPABASE_SECRET_KEY` sunt goale, fișierele merg în `backend/storage/` și sunt servite pe `/static`. Completează-le și backendul comută pe Supabase Storage, fără nicio altă modificare — bucket-ul (`SUPABASE_BUCKET`, implicit `foodbook-media`) e creat automat, public, la pornire, dacă nu există deja.

Fluxul unei imagini:

```
telefon (resize la 1600px, JPEG q80)
   → POST /v1/uploads/image   (validare magic bytes, Sharp: thumb 400 / feed 1080 / full 1600, EXIF/GPS eliminate)
   → Supabase Storage sau storage local
   → rand in uploaded_images  (leaga cheia de utilizator, tine dimensiunile)
   → POST /v1/recipes cu imageKeys
```

În baza de date se salvează **object key-ul**, nu URL-ul. URL-ul se construiește în backend din `SUPABASE_URL` + bucket, deci providerul se poate schimba fără migrație.

**EXIF/GPS**: Sharp nu copiază metadatele originalului în variantele generate (nu se apelează `withMetadata()`), deci pozele publicate nu mai conțin coordonatele GPS ale telefonului care le-a făcut — verificat direct (imagine cu bloc EXIF/GPS injectat manual, procesată prin pipeline, ieșire fără `exif`).

Imaginile urcate care nu ajung niciodată într-o rețetă se șterg cu:

```bash
npm run cleanup:orphans -w @foodbook/backend   # rulează zilnic în producție
```

## API

Toate rutele sunt sub `/v1` și cer token, în afară de `/health` și `/auth/*`.

| Metodă | Rută | Ce face |
|---|---|---|
| POST | `/auth/register` `/auth/login` | cont nou / autentificare |
| POST | `/auth/refresh` `/auth/logout` | rotație și revocare refresh token |
| GET PATCH | `/me` | profilul propriu |
| POST | `/me/avatar` | poză de profil (multipart) |
| GET | `/users/:username` | profil public (include `isFollowedByMe`) |
| GET | `/users/:username/recipes` | rețetele unui utilizator |
| POST | `/uploads/image` | urcă o imagine, întoarce cheia |
| POST GET PATCH DELETE | `/recipes` `/recipes/:id` | CRUD rețete (editarea reface complet imaginile/ingredientele/pașii) |
| GET | `/feed?scope=all\|following\|discover` | feed cronologic sau după scor de engagement |
| POST DELETE | `/recipes/:id/like` `/recipes/:id/save` | apreciere / salvare, idempotent |
| GET | `/me/saved` | rețetele salvate |
| GET POST | `/recipes/:id/comments` | comentarii, un nivel de răspuns |
| DELETE | `/comments/:id` | doar autorul |
| POST DELETE | `/users/:username/follow` | urmărire, idempotent |
| GET | `/users/:username/followers` `/following` | liste de urmăritori/urmăriți |
| GET | `/categories` `/categories/:slug/recipes` | categorii fixe + rețete pe categorie |
| GET | `/search/recipes?q=` `/search/users?q=` | căutare cu diacritice ignorate |
| GET | `/notifications` `/notifications/unread-count` | notificări (fără push, vezi PLAN.md) |
| POST | `/notifications/read` | marchează toate ca citite |

Listele sunt paginate cu cursor: `?cursor=<opac>&limit=20`. Offset-ul duplică și sare postări când apare conținut nou.

## Rate limiting

Plafon implicit de 120 cereri/minut pe toate rutele (protecție DoS generică), plus limite specifice pe rutele cu risc de abuz, urmărite după utilizator autentificat (nu doar IP, ca să nu penalizeze o rețea/NAT partajat):

| Rută | Limită |
|---|---|
| `POST /auth/register` | 5/oră/IP |
| `POST /recipes` | 10/zi/utilizator |
| `POST /recipes/:id/comments` | 60/oră/utilizator |
| `POST /uploads/image` | 20/oră/utilizator |

Activ doar cu `NODE_ENV=production` (pe Render) — dezactivat implicit în dezvoltare, altfel suita e2e (care înregistrează câteva conturi la fiecare rulare) ar lovi pragul de înregistrări în cadrul aceleiași ore.

## Deploy pe Render

[render.yaml](render.yaml) la rădăcina repo-ului descrie un Blueprint: build-ul face `prisma generate` + `prisma migrate deploy` + `tsc`, iar pornirea rulează direct `backend/dist/main.js`. În Render Dashboard → New → Blueprint, alegi acest repo și completezi manual variabilele marcate `sync: false` (`DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`) — nu sunt scrise în fișier ca să nu ajungă în git. Restul (TTL-uri, numele bucket-ului, limita de imagine) au valori implicite editabile direct în `render.yaml`.

## Verificare

```bash
npm run lint
npm run typecheck
npm run build
npm run test:e2e     # cere API pornit + DB; 97 verificari pe tot fluxul
```

`test:e2e` parcurge înregistrare, upload, creare/editare, feed (toate cele 3 scope-uri), paginare, permisiuni, profil, rotația tokenului, ștergere, like/comentarii/follow/salvare, categorii, căutare și notificări. Rulează-l după orice schimbare în backend.

## Decizii care par mărunte dar nu sunt

- **Deny-by-default**: guard-ul JWT e global; o rută publică trebuie marcată explicit cu `@Public()`. Ruta nouă uitată e protejată, nu deschisă.
- **`recipe_images` ca tabel separat** de la început, deși UI-ul arată o singură imagine. Limita e 5/rețetă și migrarea ulterioară ar atinge feed-ul, editorul și toate query-urile.
- **Cel puțin unul dintre imagine / titlu / descriere** e obligatoriu. Restul câmpurilor sunt opționale, dar o postare complet goală n-are ce afișa în card.
- **Contoare denormalizate** (`likes_count`, `followers_count` etc.) — actualizate în aceeași tranzacție cu acțiunea, nu recalculate cu `COUNT(*)`.
- **Soft delete** pentru rețete și comentarii: necesar pentru moderarea din Etapa 3.
- **Dimensiunile imaginii** sunt ale variantei stocate, nu ale originalului — clientul calculează aspect ratio pe fișierul real, deci cardul nu sare când se încarcă poza.
- **„Am dat like/am salvat?" fără N+1**: un singur query `IN (...)` per pagină pentru toată pagina de rezultate, nu un JOIN sau o cerere per rând (`ViewerFlagsService`).
- **Editarea unei rețete refolosește schema de creare** (`RecipeForm` pe mobil, `createRecipeSchema` pe server) — formularul retrimite starea completă dorită, inclusiv cheile imaginilor păstrate (expuse explicit în `RecipeImage.key`), nu doar diff-uri.
- **Categorie unică per rețetă**, nu many-to-many — simplifică formularul; hashtag-urile libere rămân amânate.
- **Build-ul backend apelează `tsc` direct**, nu `nest build` — pe Windows, wrapper-ul suplimentar al `nest-cli` a produs de mai multe ori un `dist/` incomplet dintr-o cursă (race) între terminarea procesului și scrierea pe disc.
- **Vizualizarea pe tot ecranul a pozelor** (`ImageViewer`) folosește un `ScrollView` nativ cu `maximumZoomScale` pentru pinch-zoom, nu `react-native-gesture-handler`/`reanimated` — deși ambele sunt deja instalate tranzitiv (le aduce `expo-router`), zoom-ul nativ e suficient pentru cerință și nu adaugă o dependență explicită de întreținut. Zoom-ul funcționează doar pe iOS (limitare documentată a `ScrollView` în React Native); pe Android rămâne doar swipe între poze.
- **Supabase Storage cu cheia service role** (`SUPABASE_SECRET_KEY`), nu cheia publishable — backendul e de încredere și scrie/șterge direct, fără reguli RLS suplimentare. Cheile de Supabase Auth (`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWKS_URL`) rămân nefolosite: aplicația are propriul JWT, nu Supabase Auth.
- **Rate limiting urmărit după utilizator, nu doar IP**, pe rutele autentificate — un IP de rețea mobilă sau NAT de birou e adesea partajat de mai mulți utilizatori reali; urmărirea după `req.user.id` (setat deja de guard-ul JWT) evită blocarea încrucișată. Rămâne pe IP doar la `/auth/register`, unde nu există încă un utilizator autentificat.
- **Rate limiting dezactivat în afara producției** — activ doar cu `NODE_ENV=production`, ca dezvoltarea și suita e2e să nu fie blocate de propriile limite.
