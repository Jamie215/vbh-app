# HandsUP

**Hands Up: Bone Health Program for Osteoporosis** — a web app that guides
people through a structured, video-based exercise program, tracks their
progress, and delivers an interactive bone-health eLearning module.

It's a static single-page app (no build step for the app itself), hosted on
**Cloudflare Pages**.

**This is a demo version.** It has no backend: one built-in test account with
sample data, held in the browser. Everything can be tried, but changes are
lost when the page is reloaded. Sign in with `demo@handsup.test` /
`HandsUpDemo` (also shown on the Log In page).

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
- **Accounts** — in the demo, sign-in and sign-out with the demo account only;
  sign-up and password reset show "not available in the demo".

## Tech stack

- **Frontend** — vanilla JavaScript (no framework), client-side routing, and
  **Tailwind CSS**. Third-party libraries load from CDN: YouTube IFrame API,
  Chart.js, Popper + Tippy.
- **Data** — a data layer (`src/js/data.js`) that every sign-in, read and write
  goes through. Its demo version serves the sample data in
  `src/js/demo-data.js` from memory. To connect a backend, replace the function
  bodies in `data.js` and keep their names and `{ data, error }` results.
- **Hosting** — any static host. Today [Cloudflare Pages](https://pages.cloudflare.com),
  using `_headers` / `_redirects`.

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
    data.js             data layer (demo version: in-memory sample data)
    demo-data.js        the demo account and its sample data
    auth.js             sign up / in / out, password recovery
    navigation.js       view switching + client-side routing
    playlists.js        playlist definitions
    videos.js           video playback and set/rep tracking
    progress.js         My Progress charts and detail panels
    manual_entry.js     logging past workouts
    alerts.js           milestone / pacing / reset alerts
    modals.js           alert & confirm dialog system
    utility.js          shared state and helpers
build/
  input.css             Tailwind entry
  tailwind.config.js    Tailwind config
```

## The demo account and sample data

`src/js/demo-data.js` holds the demo account (email, password, name) and one
participant part-way through week 5: workouts, external activities and
eLearning progress. Dates are stored as "days ago", so the program-week logic
shows the same picture whenever the demo is opened. Edit that file to change
the starting point; the eLearning progress in it was recorded from the real
course, so re-record it if the course's lessons change.

The demo keeps the account signed in across reloads (in `sessionStorage`) but
always reloads the sample data. Nothing is sent anywhere.

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

Then start a local server and open the address it prints (normally
http://localhost:3000):

```bash
npm start
```

No keys or accounts are needed. `npm start` runs `serve` with `serve.json`,
which sends unknown paths to `index.html` (so reloading a page such as
`/progress` works) and turns off `serve`'s clean URLs, which would otherwise
redirect the eLearning course's `index.html` and stop it loading. Another
static server works too if it does the same two things.

## Deployment

The app deploys to Cloudflare Pages:

- **Build output / root**: `src/`
- **Environment variables**: none
- Remember to run `npm run build:css` so `src/assets/css/tailwind.css` is up to
  date before deploying.

## Updating the eLearning module

The Rise export is used **unmodified**. Its loader (`lib/dist/*.js`) looks for
`window.parent.RiseLMSInterface`, which `src/js/navigation.js` defines, and
sends Rise's progress and bookmark calls through it to the data layer
(`Data.saveEducationProgress`).

1. In Rise, export the course as **Web** (not SCORM/LMS) and unzip it.
2. Replace everything in `src/education/content/` with the export. Asset
   folder names change between exports, so don't merge folders.
3. Check that `index.html` has `"loadOnlyInLms":false` in its `__CONFIG__`
   block. Nothing else in the export needs editing.
4. If lessons were added, removed or renamed, update `EDUCATION_LESSONS` in
   `src/js/app.js`. The lesson IDs are in the base64 payload in
   `runtime-data.js`. Editing blocks inside a lesson keeps its ID, but
   partial progress on changed blocks resets. Completed lessons stay
   complete.
5. Sign in, go through part of a lesson, open Home and go back to the course.
   The sidebar percentage and lesson rings should be kept, and Home should
   name the lesson. (In the demo, a reload resets to the sample progress.)
   If lessons changed, also re-record the sample progress in
   `src/js/demo-data.js`.

## Notes

- `.env`, `node_modules/` and local database schema files are git-ignored.
- This program is part of the HULC / MSKIF bone-health work.
