# Voice Broadcast — Priest Audio Message to the Congregation

**Date:** 2026-09-10
**Status:** Design approved in brainstorming; not yet implemented.
**Goal:** Let an authorized leader upload a ~1 minute audio message from the priest and
deliver it as a phone call to every active member with a phone number.

---

## 1. Feasibility summary

Doable, and most of the moving parts already exist in this repo.

| Piece | Status |
|---|---|
| Twilio account, credentials, client wrapper | Exists — `backend/src/services/twilioService.js` |
| Voice-enabled Twilio number + TwiML serving | Exists — `backend/src/controllers/voicemailController.js` |
| Authenticated media proxy from Twilio | Exists — `voicemailController.streamRecording` |
| Recipient selection + E.164 normalization + throttled fan-out | Exists — `backend/src/controllers/smsController.js` |
| Role-gated broadcast routes + activity logging | Exists — `backend/src/routes/smsRoutes.js` |
| Admin broadcast UI to model against | Exists — `frontend/src/components/admin/SmsBroadcast.tsx` |
| Outbound calling, audio hosting, opt-out, dispatch queue | **New — this spec** |

Cost at ~400 recipients: roughly `$0.014/min` for the call plus roughly `$0.0075` per call
for answering-machine detection, so **about $9 per broadcast**. Confirm current rates in the
Twilio console; these are list prices and are not contractual.

---

## 2. Decisions taken during brainstorming

| Decision | Choice | Consequence |
|---|---|---|
| How the priest records | **Upload a file** from the admin dashboard | Needs upload + hosting; no IVR recording flow |
| Where audio lives | **OCI VM disk** | Needs a path outside the repo, a backup note, and an `nginx` body-size bump |
| Audio format | **mp3/wav only**, converted by hand before upload | No `ffmpeg` dependency; strict validation required |
| Voicemail handling | **Answering-machine detection, `DetectMessageEnd`** | Full message lands in voicemail; ~cent/call and up to ~30s added per call |
| Dispatch model | **DB-backed queue + in-process background dispatcher** | Live progress, working cancel, survives restart |

---

## 3. Hard prerequisites

These are not optional; the feature cannot work without them.

1. **`PUBLIC_API_BASE_URL` env var.** There is no public base URL anywhere in the backend
   today. Inbound voicemail TwiML gets away with relative `action=` paths because Twilio
   resolves those against the URL it called. Outbound calls have no such context —
   `<Play>`, the TwiML URL, and status callbacks all require absolute `https://` URLs.
   Must be added to `.github/workflows/deploy-backend.yml` (both the `env:` block and the
   `envs:` passthrough list and the `.env` writing section).

2. **`VOICE_MEDIA_DIR` env var**, pointing outside `/var/www/repo`. Suggested
   `/var/www/church-media/voice-broadcasts`, created once with ownership matching the pm2
   user. The deploy does `git reset --hard FETCH_HEAD` with **no `git clean`**, so untracked
   files inside the repo would survive today — but relying on that is fragile, and anything
   under the repo is one `git clean -fdx` away from deletion.

3. **`nginx client_max_body_size`.** Default is 1MB. A one-minute mp3 can exceed that. Raise
   to 10MB for the upload route or server-wide, or uploads fail with a 413 that will look
   like a generic frontend error.

4. **Backup.** VM disk is the one storage tier in this system with no backup. Add the media
   directory to whatever backup covers the box, or accept that past broadcast audio is lost
   if the VM is rebuilt. The delivery records survive either way — they are in Postgres.

---

## 4. Data model

Migration adds two tables and one member column. Migrations run automatically on deploy
(`npx sequelize-cli db:migrate` in the workflow), so no manual production step.

### `voice_broadcasts`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `created_by` | BIGINT FK → members | |
| `role` | STRING(50) | role at send time, matching the `sms_logs` convention |
| `title` | STRING(255) | admin-facing label, e.g. "Fasting season message" |
| `audio_filename` | STRING(255) | basename on disk, server-generated, never client-supplied |
| `audio_mime` | STRING(50) | `audio/mpeg` or `audio/wav` |
| `audio_bytes` | INTEGER | |
| `duration_seconds` | INTEGER | parsed at upload |
| `media_token` | STRING(64) UNIQUE | 32 random bytes, hex; authorizes the public media URL |
| `media_token_revoked_at` | DATE nullable | set when the broadcast completes |
| `status` | ENUM | `draft`, `testing`, `queued`, `sending`, `completed`, `cancelled`, `failed` |
| `dry_run` | BOOLEAN | |
| `recipient_count` | INTEGER | |
| `started_at`, `completed_at` | DATE nullable | |

### `voice_broadcast_calls`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `broadcast_id` | BIGINT FK | indexed |
| `member_id` | BIGINT FK nullable | |
| `to_number` | STRING(20) | E.164, snapshotted at queue time |
| `call_sid` | STRING(64) nullable, indexed | |
| `status` | ENUM | `pending`, `dispatching`, `queued`, `ringing`, `in_progress`, `completed`, `busy`, `no_answer`, `failed`, `cancelled`, `dry_run` |
| `answered_by` | STRING(32) nullable | Twilio `AnsweredBy`: `human`, `machine_end_beep`, … |
| `duration_seconds` | INTEGER nullable | |
| `error_code` | STRING(20) nullable | Twilio error code |
| `attempt_count` | INTEGER default 0 | |

Unique index on `(broadcast_id, to_number)` so a retry or double-click cannot call the same
person twice within one broadcast.

### `members.voice_opt_out_at`

Nullable DATE. There is **no opt-out concept anywhere in this codebase today** — a grep for
`opt_out`, `opt_in`, and `unsubscribe` across models, controllers, and routes returns
nothing, including for SMS. This column is the start of one.

---

## 5. API surface

All admin routes gated exactly as SMS is: `firebaseAuthMiddleware`, then
`role(['secretary', 'church_leadership', 'admin'])`, then `activityLoggerMiddleware('VOICE')`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/voice-broadcasts` | multipart upload → `draft` |
| `GET` | `/api/voice-broadcasts` | list with counts |
| `GET` | `/api/voice-broadcasts/:id` | detail + per-status tallies |
| `GET` | `/api/voice-broadcasts/:id/audio` | **authenticated** preview for the admin UI |
| `POST` | `/api/voice-broadcasts/:id/test` | dial one number only |
| `GET` | `/api/voice-broadcasts/:id/recipients` | preview the resolved recipient list |
| `POST` | `/api/voice-broadcasts/:id/send` | queue the full run, returns immediately |
| `POST` | `/api/voice-broadcasts/:id/cancel` | stop dispatch, cancel in-flight calls |
| `DELETE` | `/api/voice-broadcasts/:id` | drafts only; deletes the file |

Public routes, **no Firebase auth**, all Twilio-signature-validated except the media route:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/voice-broadcasts/media/:token` | what `<Play>` fetches; token-authorized |
| `POST` | `/api/voice-broadcasts/twiml/:callId` | per-call TwiML, branches on `AnsweredBy` |
| `POST` | `/api/voice-broadcasts/status` | Twilio status callback |
| `POST` | `/api/voice-broadcasts/optout/:callId` | DTMF keypress handler |

---

## 6. Upload and validation

`multer` is already a backend dependency (memory storage, used for bank CSV imports).

Validation, in order, rejecting with a specific message at each step:

1. **Size** — reject over 10MB before reading.
2. **File signature** — read the leading bytes and confirm a real mp3 (`ID3`, or an
   `0xFF 0xFB`-family frame sync) or a real RIFF/WAVE header. **Extension and
   `Content-Type` are not trusted.** This matters more than it looks: a mislabeled file
   makes Twilio play silence to the entire congregation while reporting every single call
   as `completed`. There is no other point in the system where that error becomes visible.
3. **Duration** — parse with `music-metadata` (new dependency, pure JS, no `ffmpeg`) and
   reject over 120s. Twilio bills per minute and a runaway file is both costly and rude.
4. **Write to disk** under `VOICE_MEDIA_DIR` with a server-generated name
   (`<broadcast_id>-<random>.mp3`). The client filename is never used in a path.

---

## 7. TwiML

Because answering-machine detection runs in synchronous mode, Twilio does **not** request
the TwiML URL until detection finishes, and then passes `AnsweredBy`. So a single endpoint
serves both cases and branches:

**Human answered** — identification, message, spoken opt-out, keypress opt-out:

```xml
<Response>
  <Gather numDigits="1" action="{BASE}/api/voice-broadcasts/optout/{callId}" method="POST" timeout="5">
    <Say voice="alice">This is a message from Debre Tsehay Abune Aregawi Church.</Say>
    <Play>{BASE}/api/voice-broadcasts/media/{token}</Play>
    <Say voice="alice">To stop receiving these calls, press 9. To reach the church, call {CHURCH_PHONE}.</Say>
  </Gather>
</Response>
```

**Machine detected (`machine_end_beep` and friends)** — no `<Gather>`, since nobody presses
a key on a voicemail; the opt-out is spoken instead:

```xml
<Response>
  <Say voice="alice">This is a message from Debre Tsehay Abune Aregawi Church.</Say>
  <Play>{BASE}/api/voice-broadcasts/media/{token}</Play>
  <Say voice="alice">To stop receiving these calls, call {CHURCH_PHONE}.</Say>
</Response>
```

The leading `<Say>` is deliberate: it satisfies the FCC requirement to identify the calling
entity at the start of an artificial or prerecorded message, and it means any residual
truncation eats boilerplate rather than the priest's first words.

**Media caching.** The media response sets `Cache-Control: public, max-age=3600` and a
stable `ETag`. Twilio caches `<Play>` media; without this the VM serves the file once per
call — 400 fetches for one broadcast.

---

## 8. Dispatch

`POST /send` is transactional and fast: resolve recipients, insert
`voice_broadcast_calls` rows with status `pending`, set the broadcast to `queued`, return.
It never calls Twilio inline. The nginx proxy timeout is 60s and dispatching 400 calls at
Twilio's ~1 call/sec takes about seven minutes — the synchronous pattern in
`smsController.sendAll` would time out and surface in the browser as a CORS error.

A background dispatcher then drains the queue:

- Claims a small batch per tick with a conditional update (`pending` → `dispatching`), so
  the claim is atomic and a second process cannot pick up the same rows.
- Creates each call with `machineDetection: 'DetectMessageEnd'`, an absolute `url` to the
  per-call TwiML route, `statusCallback` with events `initiated`/`ringing`/`answered`/`completed`.
- Rate limited by `VOICE_BROADCAST_CPS` (default 1), concurrency capped.
- On start-up, re-claims rows stuck in `dispatching` so a pm2 restart mid-broadcast resumes
  rather than stranding them.

**Single-instance assumption.** The deploy runs `pm2 start src/server.js` in fork mode, so
there is one process. The atomic claim above is what makes this safe if that ever changes;
do not remove it.

**Cancel** sets the broadcast to `cancelled`, stops the dispatcher, marks remaining
`pending` rows `cancelled`, and issues Twilio cancel for calls still in `queued`/`ringing`.

---

## 9. Recipient selection and suppression

Base query mirrors `smsController.sendAll`: active members with a non-empty phone number,
normalized through the same E.164 logic. Then:

- Drop anyone with `voice_opt_out_at` set.
- Drop duplicates by normalized number — households sharing a number should ring once.
- Skip numbers that fail normalization, and surface them in the response so they can be
  fixed, rather than silently dropping them.

Scope for v1 is the whole active roster, as requested. Group and department targeting can
reuse the existing `MemberGroup` / `DepartmentMember` joins later; the schema does not need
to change to add it.

---

## 10. Safety

**Twilio signature validation.** Shared middleware using `twilio.validateRequest` against
`TWILIO_AUTH_TOKEN` and the absolute URL, applied to every webhook here. The existing
voicemail webhooks in `backend/src/routes/voicemailRoutes.js` have none — the code comment
says *"for now open POSt"* — meaning anyone who knows the path can forge voicemail records
and trigger leadership notifications. Retrofitting those three routes is in scope for this
work since the middleware is being written anyway.

**Dry run.** `TWILIO_DRY_RUN` is already written into the production `.env` by the deploy
workflow, and **nothing in the backend reads it** — the only `DRY_RUN` in the codebase is an
unrelated flag in `backend/scripts/import-zelle-transactions.js`. It becomes real here: when
set, or when `dry_run` is requested per-broadcast, the full pipeline runs and writes rows
with status `dry_run` but creates no Twilio calls and spends nothing.

**Test-before-send.** `POST /:id/test` dials a single number the caller supplies. The UI
requires at least one successful test before enabling Send.

**Calling hours.** Dispatch refuses to start outside 09:00–20:00 America/Chicago, using the
existing `backend/src/config/timezone` helper. The TCPA window is 8am–9pm in the
*recipient's* zone; the tighter fixed window is the simple safe subset for a Dallas
congregation. Override requires an explicit flag.

**Confirmation.** Send requires the recipient count to be echoed back by the client, so
"send to 412 people" is an affirmative act rather than a misclick.

**Media token.** 32 random bytes. Unguessable, revoked on completion, and it authorizes
exactly one file — the audio the whole congregation is about to hear anyway.

---

## 11. Compliance note

Prerecorded voice calls to **mobile** numbers sit under the TCPA. The commonly-cited
non-commercial and tax-exempt nonprofit exemptions apply to **residential landlines**, not
to the wireless prong. The workable posture for a church is that members provided their
numbers for congregational contact and a pastoral message is not telemarketing, which is
prior express consent — but that posture is materially stronger with the opt-out path,
the identification line, and the calling-hours guard specified above, all of which this
design includes.

**This is not legal advice.** Get the board's sign-off, or counsel's, before the first live
broadcast. The dry-run mode exists so the system can be fully exercised while that is pending.

---

## 12. Testing

Per repo convention, `DATABASE_URL=sqlite::memory:`, Twilio client mocked, no real PII in
fixtures.

**Unit:**
- File signature validation accepts real mp3/wav, rejects an m4a renamed to `.mp3`
- Duration cap rejects over-length audio
- TwiML generation for `human` vs `machine_end_beep`, with escaping of the church name
- Recipient resolution excludes opted-out members and de-duplicates shared numbers
- Calling-hours guard at boundaries in America/Chicago, including DST
- Dry run creates rows and zero Twilio calls
- Signature middleware rejects a bad signature and accepts a correct one

**Integration:**
- upload → draft → test → send → status callbacks → `completed`
- cancel mid-run leaves no `pending` rows and cancels in-flight calls
- an atomic claim under two simultaneous dispatcher ticks never double-dials

---

## 13. Frontend

New `frontend/src/components/admin/VoiceBroadcast.tsx` alongside `SmsBroadcast.tsx`, same
role gate, with a `voiceBroadcastApi.ts` matching the shape of `voicemailApi.ts`.

Flow: upload with an in-browser `<audio>` preview → recipient count with opt-out exclusions
shown → send a test to your own number → confirm count → live progress with a cancel button
→ results broken down by answered/voicemail/failed.

All strings in both `en` and `ti`, per the ongoing Tigrigna i18n work.

---

## 14. Phases

Each phase ends somewhere testable.

1. **Storage + model** — migration, models, `VOICE_MEDIA_DIR`, `PUBLIC_API_BASE_URL`,
   nginx body size, upload endpoint with validation, token media endpoint.
   *Done when:* a file can be uploaded and fetched back from the public token URL.
2. **One call end to end** — signature middleware (including the voicemail retrofit), TwiML
   generation, test-call endpoint.
   *Done when:* the priest's phone rings and plays the message, live and to voicemail.
3. **The broadcast** — queue, dispatcher, status callbacks, cancel, calling hours, dry run.
   *Done when:* a dry run over the full roster produces correct rows and zero spend.
4. **Opt-out** — member column, keypress handler, suppression in recipient resolution.
   *Done when:* pressing 9 removes that member from the next broadcast's recipients.
5. **Admin UI** — bilingual, with the test-before-send gate.

---

## 15. To confirm before building

- **Actual count** of active members with phone numbers — the ~400 and ~$9 figures are placeholders.
- **Church callback number** to speak in the identification line.
- **Who may send** — the SMS roles are `secretary`, `church_leadership`, `admin`. Voice reaches
  further and costs money; `admin` and `church_leadership` only may be the better default.
- **Board sign-off** on automated calls to the congregation.
