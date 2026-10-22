# HandsUP — Migration Plan (REDCap, video hosting, authentication)

_Status: options analysis with recommendations, Oct 2026. **No option below has
been approved yet**; decisions sit with the PIs and the Research Ethics Board
(REB). Update the [Decision log](#9-decision-log) as decisions are made._

## 1. Why the current design has to change

The current app is a working prototype:

| Concern | Today | Problem for the study |
|---|---|---|
| Hosting | Cloudflare Pages (+ a Pages Function middleware) | Cloudflare (US-based) terminates HTTPS at its nearest data centre, which is not guaranteed to be in Canada, so participant data would be readable inside a non-Canadian third party |
| Data & auth | A demo data layer (`src/js/data.js`): one test account with sample data held in the browser. Supabase (auth + Postgres) was used until Oct 2026 | PIs want **REDCap** as the study database; data must stay in Canada under the institution's control |
| Video | YouTube (unlisted embeds, IFrame API) | PIs want to leave YouTube over **IP concerns**: unlisted links work for anyone who has them, and YouTube's terms grant it a licence to uploaded content |

The REB requirement: **data stays in Canada and under the institution's
control the whole way through**. Any design that routes participant data
through a global cloud service is ruled out.

## 2. What the design has to support

- **A home program people return to many times.** 6 weeks, about 2 sessions a
  week, plus the eLearning module, done remotely.
- **The app reads its own data back.** Progress charts, the current program
  week, calendar tracking and the 14-day inactivity reset all need the
  participant's history, so the server must read from REDCap as well as write.
- **Long-lived access.** A participant's access lasts 6+ weeks and is used
  dozens of times, so access by a permanent personal link (sitting in an inbox
  the whole time) is weak. See [Authentication](#4-authentication).
- **A small surface to migrate.** Every sign-in, read and write goes through
  the 16 functions of the data layer (`src/js/data.js`), and there are 21
  exercise videos plus 4 tutorial videos.

### Hosting options considered

| Option | Fits HandsUP? | Data residency |
|---|---|---|
| In-person collection to an encrypted, study-owned device | No: the program is done at home | Canada, institution-controlled |
| App on study-provided tablets, collected in person | Only if every participant gets a tablet for 6+ weeks | Canada, institution-controlled |
| **Western-managed (WTS) server in Canada** | Yes | Canada, institution-controlled |
| Commercial cloud, Canadian region (Azure Canada Central, AWS Canada) | Yes | In Canada, but the provider is subject to US law, so weaker for the REB |

## 3. Recommended architecture

**Everything on a Western-managed (WTS) server in Canada:**

```
Browser ──HTTPS──▶ Western server ──API──▶ Western REDCap
                   ├─ static site (src/) + eLearning module
                   ├─ small API that holds the REDCap token
                   └─ video files (behind login)
```

- No Cloudflare in the data path. The site, API and videos share one origin,
  so session cookies work normally and the CSP can use `connect-src 'self'`.
- The REDCap API token lives only on the server. **It must never reach the
  browser:** a REDCap token grants access to the whole project. The server decides what
  each signed-in participant may read or write.
- A commercial cloud in a Canadian region is the fallback if WTS can't host
  it, with weaker REB standing (see the table above).

## 4. Authentication

Goal: fix "anyone with the link can get in" without making older participants
manage passwords.

| Option | How it works | Security | Ease for older adults | Work |
|---|---|---|---|---|
| A. Permanent personal link | The link is the account | Weak: a forwarded or leaked email gives full access for weeks | Easiest | Small |
| B. Activation link + password | Emailed link works once; participant sets a password and logs in with email + password after that | Good | Passwords get forgotten, so frequent resets | Moderate |
| **C. Activation link + emailed code** | Each sign-in: enter email, receive a 6-digit code. No "remember this device": the session ends when the browser closes | Good: the link alone gives nothing; every sign-in needs inbox access | Nothing to remember, but a code at every visit (at least 12 over the program) | Moderate |
| D. Self-hosted login server (e.g. Keycloak) | Full identity system | Strongest | Same as B | Large, plus ongoing maintenance |

**Recommendation: C.** Choose B instead if the PIs worry that participants
won't reliably check email when logging in.

Additions for B or C:

- **Activation check:** on first use, the participant confirms something only
  they and REDCap know (e.g. year of birth), so a forwarded invitation isn't
  enough to claim the account.
- **Send emails through REDCap:** the server writes the code to the
  participant's record and a REDCap Alert emails it, so email stays inside
  Western's systems. _Confirm with the REDCap admin that Alerts fire on API
  imports_; otherwise use Western's mail relay.
- Login codes are stored hashed and expire after a few minutes. Sessions use
  an HttpOnly cookie, which works because everything is same-origin. The
  cookie ends when the browser closes; there is no "remember this device",
  since a long-lived session on a shared computer is likely to be questioned by
  the REB.

## 5. Data model in REDCap

### What the prototype stored (Supabase, until Oct 2026)

| Table | Shape | Written when |
|---|---|---|
| `workout_sessions` | One row per participant per date. `progress` is JSON: `{ playlist: { video: { set1: {reps, seconds, completed}, … } }, "external-activity": { activity: {minutes, completed} } }` | Each exercise saved, or a past day logged via manual entry |
| `user_program_state` | One row per participant: `completed_at`, `completion_method` | Program completed or reset |
| `education_progress` | One row per participant: Rise `progress` JSON + `bookmark` | About once a second while moving through the eLearning module (1-second debounce) |

(`error_log` was removed in Oct 2026; errors now only go to the browser
console.)

### Can REDCap handle irregular, ad-hoc logging?

Yes, through **repeating instruments**: a form with any number of instances
per participant and no schedule. That is REDCap's standard way to handle
diaries and logs. Blank fields cost nothing, because REDCap stores one row per
filled-in value, not per form. The "every row filled" impression comes from
the wide export.

The real constraints:

1. **Fields must be declared in advance** (data dictionary). Nested JSON must
   be flattened into fixed fields, or stored as one opaque text field.
2. **Changing fields in a live project is controlled** (draft mode, possibly
   admin approval). Design so that adding an exercise video needs no
   dictionary change.
3. **No upsert or uniqueness rules.** The server must find the matching
   instance itself (export the participant's log, match on date and video)
   before writing, or duplicates appear.
4. **Limited querying:** the API exports a participant's records with a
   filter, but can't aggregate or join. That's fine, because the app only
   needs one participant's own history and computes the rest in the browser.
5. **Every change is audit-logged.** Save eLearning progress less often (e.g.
   on lesson change or completion) to avoid flooding the log.

### Options for the exercise log

| Option | One instance = | Fields | Export | New video |
|---|---|---|---|---|
| A. Wide | One session (date) | ~190 (video × set × reps/seconds/done), mostly blank | One very wide row per session | Needs new fields |
| **B. Long** | One exercise on one date | ~12 | One row per exercise; group by date for adherence | No change |
| C. JSON blob | One session (date) | 2 | Unreadable without parsing | No change |

**Recommendation: B.** It matches how the app already saves (one exercise per
"Save"), survives exercise changes, and exports as a tidy long-format table.
Volume is small: about 120 instances per participant over the program.

### Proposed layout

| Instrument | Repeating? | Fields | Replaces |
|---|---|---|---|
| `exercise_log` | Yes | `session_date`, `playlist_id`, `video_id`, `set1–3_reps`, `set1–3_seconds`, `set1–3_done`, `removed`, `saved_at` (set by the server) | Exercises in `workout_sessions` |
| `activity_log` | Yes | `session_date`, `activity_id`, `minutes`, `done`, `removed` | `external-activity` in `workout_sessions` |
| `app_state` | No | `program_completed_at`, `completion_method`, `edu_bookmark`, `edu_progress_json`, `edu_percent_complete` | `user_program_state`, `education_progress` |

Notes:

- **Use a `removed` flag instead of deleting.** "Unchecking removes the
  exercise" becomes `removed = 1`. That keeps the audit trail clean, and
  avoids depending on whether the REDCap version supports deleting individual
  instances through the API (check with the admin).
- **`edu_progress_json` stays a blob.** It's Rise's internal resume state. The
  server also writes a plain `edu_percent_complete` for analysis.
- **Mixing with outcome measures:** if the study collects baseline or 6-week
  questionnaires, those become normal events, and these logs sit as repeating
  instruments within a "program" event.
- **Client logic is unchanged.** The program week, completion and the 14-day
  reset are computed from session dates in the browser. The browser reaches
  data only through the data layer (`src/js/data.js`), whose functions already
  return the shapes the app uses; the REDCap version re-implements those
  functions to call the server.

## 6. Video storage and streaming

No web player can prevent screen recording. The realistic goal is that **only
enrolled, logged-in participants can watch, and nobody can trivially download
a file or share a working link.**

| Option | IP protection | Data residency | Viewing quality | Work |
|---|---|---|---|---|
| 1. MP4 files on the Western server, behind login | Login required; files easy to save once logged in | Canada, institution-controlled | No quality adjustment, so it can buffer on slow internet | Small |
| **2. HLS adaptive streaming on the Western server, behind login** | Login required; split into short chunks, no single file; optional encryption | Canada, institution-controlled | Adjusts to the connection | Moderate: convert once with ffmpeg, play with hls.js |
| 3. A platform Western already licenses (e.g. Kaltura, Panopto, YuJa, Microsoft Stream) | Usually good access controls | Depends on contract; check for Canadian hosting | Good | Small, if it can embed for non-Western viewers |
| 4. Commercial hosts (Vimeo private, Bunny, Mux, Cloudflare Stream) | Good: signed links, domain lock | Viewers' IP addresses and watch history go to a third party (same objection as Cloudflare) | Good | Small |

**Recommendation: option 2 on the same Western server.** Check option 3 first:
if Western licenses a platform that is hosted in Canada and can show videos to
people without Western accounts, it means less to build.

- **Size estimate:** at about 3 minutes per video, 23 videos at three quality
  levels comes to a few GB. Confirm with the actual video lengths, and ask WTS
  about bandwidth.
- **Code changes:** replace the YouTube IFrame player (`videos.js`, plus the
  embeds in `manual_entry.js` and `navigation.js`) with a `<video>` element.
  Thumbnails come from our own files instead of `img.youtube.com`.

## 7. Content Security Policy

`src/_headers` sends the CSP in **report-only** mode, deliberately left that
way during the prototype phase. For the new stack:

- Remove the YouTube (`script-src`, `img-src`, `frame-src`) entries. (The
  Supabase entries were removed with the demo data layer in Oct 2026.) With a same-origin API, `connect-src 'self'` is enough.
- Add `media-src 'self' blob:` (plus the video host if it's separate). HLS
  players play through `blob:` URLs, so without it playback fails silently.
- **Keep `data:` in `font-src`.** The eLearning module (Rise/Storyline export)
  embeds its fonts as `data:` URLs, including the video player's icon font.
  With the current policy enforced, all 13 lessons were otherwise clean (one
  harmless `eval` feature check in a Rise library).
- Test on a preview deployment, then switch
  `Content-Security-Policy-Report-Only` to `Content-Security-Policy` so the
  policy is enforced from day one.

## 8. Open questions

| # | Question | Who |
|---|---|---|
| 1 | Can the server reach REDCap's API and send email? What bandwidth and storage come with it? | WTS |
| 2 | Do REDCap Alerts fire on API data imports? Can the API delete individual repeating instances? | REDCap admin |
| 3 | Which video platform does Western license, where is it hosted, and can it serve non-Western viewers? | Western IT |
| 4 | Is email acceptable as the login identity? Is a code at every sign-in, with sessions ending when the browser closes, acceptable to participants? | PIs / REB |
| 5 | Is login option C acceptable, or does the study need B? | PIs |
| 6 | Will baseline/follow-up outcome measures also live in REDCap (events alongside the logs)? | PIs |

## 9. Decision log

| Date | Decision | By |
|---|---|---|
| Oct 2026 | Move off Supabase to REDCap; move off YouTube | PIs |
| Oct 2026 | No participant data through Cloudflare or other global cloud services | REB requirement |
| Oct 2026 | Keep the CSP in report-only mode during the prototype; enforce it as part of the migration | Project team |
| Oct 2026 | Replace Supabase in the prototype with a demo data layer: one test account, sample data held in the browser | Project team |
| Oct 2026 | If sign-in option C is chosen: a code at every sign-in, no "remember this device" | Project team |
| — | Hosting option | _pending_ |
| — | Authentication option | _pending_ |
| — | REDCap data layout | _pending_ |
| — | Video hosting option | _pending_ |
