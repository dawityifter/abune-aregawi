# Analytics setup — Umami, self-hosted

The app ships with Umami wired in but **inert**: nothing loads and no data is
collected until the two environment variables at the bottom are set. Follow this
once and it starts working on the next frontend deploy.

Umami was chosen over Plausible or Google Analytics because the parish holds
member PII. Pageview data stays on the church's own VM, no cookies are set, no
consent banner is needed, and nobody outside the parish can see which members
looked at what.

## What the app already does

- Loads the tracker only in production builds, only when configured, and never
  when the visitor's browser sends Do Not Track.
- Records a page view on every route change (a single-page app would otherwise
  only ever report the first URL).
- **Strips identifiers before sending.** Query strings go entirely — `/dues?memberId=482&phone=...`
  is reported as `/dues` — and numeric or UUID path segments become `:id`, so
  `/departments/17/meetings/204` is stored as `/departments/:id/meetings/:id`.
  Member ids never reach the analytics database.

## 1. Run Umami on the OCI VM

Umami needs a Postgres database. Give it its own rather than pointing it at the
church database — analytics traffic has no business sharing a box with the
ledger.

```bash
ssh <your-oci-host>
sudo mkdir -p /opt/umami && cd /opt/umami
sudo tee docker-compose.yml > /dev/null <<'YAML'
services:
  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    ports:
      - "127.0.0.1:3001:3000"          # localhost only; nginx terminates TLS
    environment:
      DATABASE_URL: postgresql://umami:CHANGE_ME@db:5432/umami
      DATABASE_TYPE: postgresql
      APP_SECRET: CHANGE_ME_TO_A_LONG_RANDOM_STRING
    depends_on: [db]
    restart: always
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: umami
      POSTGRES_USER: umami
      POSTGRES_PASSWORD: CHANGE_ME
    volumes:
      - umami-db:/var/lib/postgresql/data
    restart: always
volumes:
  umami-db:
YAML
```

Replace both `CHANGE_ME` values with the same password, and `APP_SECRET` with
`openssl rand -base64 32`. Then:

```bash
sudo docker compose up -d
sudo docker compose ps          # both services should be "running"
```

## 2. Expose it through nginx

Add to the existing server block (or a new one for an `analytics.` subdomain):

```nginx
location /umami/ {
    proxy_pass         http://127.0.0.1:3001/;
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 3. Create the site in Umami

Visit `https://<your-host>/umami/`. Default login is `admin` / `umami` —
**change the password immediately**, it is a known default on a public host.

Then Settings → Websites → Add website, with the domain set to
`abunearegawi.church`. Copy the **Website ID** it gives you.

## 4. Point the app at it

Add both to the GitHub repository secrets (Settings → Secrets and variables →
Actions), then to the frontend build step in
`.github/workflows/firebase-deploy.yml` alongside the other `REACT_APP_*` vars:

```
REACT_APP_UMAMI_SRC=https://<your-host>/umami/script.js
REACT_APP_UMAMI_WEBSITE_ID=<the website id from step 3>
```

They must be present at **build** time, not runtime — Create React App inlines
`REACT_APP_*` into the bundle.

Redeploy the frontend. Within a minute or two the Umami dashboard should show
traffic.

## 5. Check it is actually working

```bash
# The script should be served, and the bundle should reference it.
curl -sI https://<your-host>/umami/script.js | head -1
curl -s https://abunearegawi.church/ | grep -o 'main\.[a-z0-9]*\.js'
```

Then load the site in a browser with DevTools open: `script.js` should appear in
the Network tab, followed by a `POST` to `/umami/api/send` on each navigation.

If nothing appears, the usual causes are: the env vars were missing at build
time (rebuild), the browser sends Do Not Track (expected — try another), or an
ad blocker is blocking it (also expected; self-hosting reduces but does not
eliminate this).

## What to look at first

Three questions worth answering before building anything else:

1. **Does anyone return?** Returning-visitor share, week over week. This is the
   number the whole engagement effort is trying to move.
2. **Does the announcements feature get used?** Views of `/` and `/dashboard`
   against whether an announcement was active that week.
3. **What do members actually open?** If `/dues` and `/donate` still dominate
   after the liturgical band ships, the band is not doing its job.

## Privacy note for leadership

Umami stores no cookies and no personal data. It records the page path, referrer,
browser, and country. Member identifiers are stripped before sending, and the
database sits on the church's own server. Nothing is shared with any third
party. This is worth stating plainly in the privacy page at `/privacy` once it
is switched on.
