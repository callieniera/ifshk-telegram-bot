# ifshk-telegram-bot

A Node.js / Fastify backend that hosts a Telegram bot and manages "check-in" events
for the IFSHK (Ingress) community. The app receives Telegram updates via webhook,
serves event lifecycle logic (passcodes, restocks, leader notifications), and syncs
event data to Google Sheets.

---

## Requirements

- **Node.js 22 or newer** (required for the built-in `node:sqlite` module used by the
  `database/` layer; the project was developed and tested on Node 26).
- A **Telegram bot token** from [@BotFather](https://t.me/BotFather).
- A **Google service account** with access to the relevant Google Sheet(s), exported as
  a JSON key file (used to read/write event data).
- The server must be reachable from the internet (Telegram calls your webhook over
  HTTPS), so you'll need a public URL.

---

## 1. Install dependencies

```bash
npm install
```

> The `canvas` and `jsdom` packages contain native dependencies. On some systems you
> may need system libraries (e.g. on Debian/Ubuntu: `libcairo2-dev`,
> `libpango1.0-dev`, `libjpeg-dev`, `libgif-dev`, `librsvg2-dev`).

---

## 2. Configure environment variables

The app loads configuration from a `.env` file in the project root
(`dotenv` is loaded at the top of `app.js`). Copy the template and fill in the values:

```bash
cp .env.example .env
```

### Required variables

| Variable                     | Description                                                                                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                       | The TCP port the Fastify server listens on.                                                                                                                               |
| `TG_BOT_TOKEN`               | The Telegram bot token from BotFather.                                                                                                                                                            |
| `SERVERURL`                  | The public base URL of this server (no trailing slash), e.g. `https://example.com`. The Telegram webhook is registered at `${SERVERURL}/telegram`. Must be a public HTTPS URL. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The full JSON contents of a Google service account key file, **inline** as a single string (e.g. via shell single quotes). Must include `client_email` and `private_key`. |

> **Note on `GOOGLE_SERVICE_ACCOUNT_JSON`:** the value must be the entire service
> account JSON on one line. In `.env`, wrap it in single quotes and escape any
> embedded newlines. The app parses it with `JSON.parse` and signs a JWT to obtain a
> Google OAuth access token for the Sheets scope.

### Optional variables

| Variable            | Description                                                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timezone`          | UTC offset in hours used to timestamp log output. Defaults to `8` (UTC+8).                                                                                                              |
| `BOT_NAME_FOR_TEST` | If set, the bot's display name is forced to this value via `setMyName`. Useful for testing multiple bot names. Omit in production.                                                       |
| `GLOBAL_ADMIN_IDS`  | A JSON array of Telegram user IDs that should be treated as global admins, e.g. `"[123456, 789012]"`. Optional; the admin set is empty if unset.                                        |

### Variables set automatically by the app

The following are populated at runtime (do **not** set them in `.env`):
`BOT_USERNAME`, `TG_BOT_USERNAME`, `TG_BOT_USERID`.

### `.env.example` template

```dotenv
# --- Required ---
PORT=25596
TG_BOT_TOKEN='REPLACE_WITH_YOUR_BOT_TOKEN'
SERVERURL='https://your-public-domain.example.com'
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----","client_email":"...@...iam.gserviceaccount.com","client_id":"..."}'

# --- Optional ---
# timezone=8
# BOT_NAME_FOR_TEST="My Bot"
# GLOBAL_ADMIN_IDS='[123456789]'
```

---

## 3. Run the application

```bash
node app.js
```

On startup the app will:

1. Validate that all required environment variables are present.
2. Initialize Google service-account auth and the i18n catalog.
3. Load persisted events from the local database (`database/storage.db`).
4. Register the Telegram webhook at `${SERVERURL}/telegram` and confirm it with Telegram.
5. Start listening for HTTP requests on the configured `PORT`.

You can stop the server with `Ctrl+C` — a graceful shutdown flushes pending
database writes and cancels scheduled timers.

---

## Project structure

```
app.js                 Application entry point (Fastify server + wiring)
database/              SQLite storage layer (node:sqlite); storage.db is created at runtime
events/                Event lifecycle, scheduling, and Google Sheets sync
helpers/               Shared classes (storage, Google auth) and utility functions
i18n/                  Localization catalog (en, zh-CN, zh-HK)
telegram/              Telegram bot: webhook, command/callback/message handlers
test.html              Standalone helper page (not part of the server)
```

---

## Notes

- The `database/`, `node_modules/`, and `.env` files are git-ignored. The SQLite
  database file is created automatically on first run.
- Because the app talks to Telegram via a webhook, it must run behind a public HTTPS
  endpoint. For local development, expose it with a tunnel (e.g. `ngrok` or
  `cloudflared`) and set `SERVERURL` to the tunnel URL.
- The service-account credentials in `GOOGLE_SERVICE_ACCOUNT_JSON` are sensitive; never
  commit a real `.env` file.
