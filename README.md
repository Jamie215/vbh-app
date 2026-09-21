# HandsUP

**Hands Up: Bone Health Program for Osteoporosis** — a web app that guides
people through a structured, video-based exercise program, tracks their
progress, and delivers an interactive bone-health eLearning module.

It's a static single-page app (no build step for the app itself) deployed on
**Cloudflare Pages**, with **Supabase** for authentication and data.

## Features

- **Exercise program** — weekly workout playlists (Beginner weeks 1–3, Advanced
  weeks 4–6) built from YouTube exercise videos, each with prescribed sets, reps
  or hold times, per-side tracking, and equipment options.
- **Workout tracking** — log sets and reps as you go; the app tracks which
  session you're on and advances the program week over time.
- **My Progress** — Chart.js history of completed workouts, with per-day and
  all-time detail views.
- **Manual entry** — log past workouts you forgot to record.
- **Contextual alerts** — milestone, pacing, and inactivity-reset messaging
  (progress resets after 14+ days of inactivity).
- **eLearning module** — an embedded interactive course on bone health and
  osteoporosis, with its own progress tracking.
- **Accounts** — email sign-up/sign-in, password recovery, and a signup safety
  agreement, all via Supabase auth.

## Tech stack

- **Frontend** — vanilla JavaScript (no framework), client-side routing, and
  **Tailwind CSS**. Third-party libraries load from CDN: Supabase JS, YouTube
  IFrame API, Chart.js, Popper + Tippy.
- **Backend / data** — [Supabase](https://supabase.com) (auth + Postgres).
  Tables used by the app: `user_program_state`, `workout_sessions`,
  `education_progress`, and `error_log`.
- **Hosting** — [Cloudflare Pages](https://pages.cloudflare.com), including a
  Pages Function middleware and `_headers` / `_redirects`.

## Project structure

```
src/
  index.html            app shell (SPA)
  _headers              security headers (CSP, HSTS, etc.)
  _redirects            SPA fallback (/* → /index.html)
  assets/
    css/                style.css + generated tailwind.css
    img/                logos and thumbnails
  education/content/    embedded eLearning module (Articulate Rise export)
  js/
    app.js              app init, session routing, program-week logic
    auth.js             sign up / in / out, password recovery
    navigation.js       view switching + client-side routing
    playlists.js        playlist definitions + Supabase client creation
    videos.js           video playback and set/rep tracking
    progress.js         My Progress charts and detail panels
    manual_entry.js     logging past workouts
    alerts.js           milestone / pacing / reset alerts
    modals.js           alert & confirm dialog system
    utility.js          shared state and helpers
build/
  input.css             Tailwind entry
  tailwind.config.js    Tailwind config
functions/
  _middleware.js        Cloudflare Pages middleware — injects env vars
```

## How configuration works

Supabase credentials are **not** hardcoded. The Cloudflare Pages middleware
(`functions/_middleware.js`) injects them into each HTML response at request
time as `window.ENV`, read from the environment:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

`playlists.js` reads `window.ENV` and creates the Supabase client. Set these as
environment variables on the Cloudflare Pages project (and for local
development — see below).

## Local development

Prerequisites: [Node.js](https://nodejs.org) and npm.

```bash
# install dev dependencies (Tailwind)
npm install

# build the stylesheet once...
npm run build:css
# ...or rebuild on change while developing
npm run watch:css
```

To run the app locally with the Supabase env injected exactly as in production,
serve `src/` with the Cloudflare Pages dev server:

```bash
npx wrangler pages dev src
```

Provide `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the dev server (e.g. via a
`.dev.vars` file or your shell environment) so the middleware can inject them.

> A plain static file server will serve the pages but **won't** run the
> middleware, so `window.ENV` will be empty and Supabase calls will fail. Use
> the Pages dev server (or set `window.ENV` yourself) for a working local
> session.

## Deployment

The app deploys to Cloudflare Pages:

- **Build output / root**: `src/`
- **Functions**: `functions/` (the env-injection middleware runs automatically)
- **Environment variables**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- Remember to run `npm run build:css` so `src/assets/css/tailwind.css` is up to
  date before deploying.

## Notes

- Database schema files (`01_schema_Supabase.sql`, `02_schema_REDCap.sql`), the
  `.env`, and `node_modules/` are git-ignored.
- This program is part of the HULC / MSKIF bone-health work.
