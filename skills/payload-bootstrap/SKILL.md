---
name: payload-bootstrap
description: Create a Payload CMS 3 + Next.js project from the official website template with libSQL / Turso, or add Payload to an existing Next.js app, then define the data model. Use when starting a new site, installing Payload into a frontend, configuring the SQLite adapter, setting environment variables, or adding collections and globals. Never scaffolds from scratch.
license: MIT
metadata:
  version: "1.0.0"
---

# Payload bootstrap

Start from the official template every time. It already contains working live preview, drafts, SEO fields, redirects, search, sitemaps, and tests. Rebuilding these by hand is the most common cause of broken projects.

## Choose the path

| Scenario (from `payload-project-kickoff`) | Path |
| --- | --- |
| A. New site | Step 1 (template) |
| B. Existing Next.js app, already refactored by `project-architecture` | Step 2 (add to existing app) |
| D. Payload already installed | Skip to Step 4 (data model) |

## Step 1: New site from the template

1. Pick the agent value: `cursor` or `codex` (installs the official skill into `.agents/skills`), or `claude` (installs into `.claude/skills`).
2. From the parent folder of the new project, run:

```bash
npx create-payload-app@latest --name <project-slug> --template website --db sqlite --db-accept-recommended --agent cursor --use-pnpm
```

3. If the current folder must be the project root (it only contains `PROJECT.md` and `AGENTS.md`), use `--name app --no-git`, move everything from `app/` (including dotfiles) into the current folder, delete the empty `app/` folder, then run `git init`.
4. The command writes `AGENTS.md` (or `CLAUDE.md`). Append the rules from the `payload-project-kickoff` AGENTS template to it instead of replacing it.
5. Run the project normalization in the `project-architecture` skill (Step 2: move globals into `src/globals`).

## Step 2: Add Payload to an existing Next.js app

`create-payload-app` asks interactive questions in this mode, which blocks unattended agents. Follow the manual steps in [references/add-to-existing-app.md](references/add-to-existing-app.md). Do not start until every route lives under `src/app/(frontend)/`, because Payload's admin needs its own root layout in `src/app/(payload)/`.

## Step 3: Configure the database (libSQL / Turso)

Open `src/payload.config.ts` and make the adapter match this exactly:

```ts
import { sqliteAdapter } from '@payloadcms/db-sqlite'

// inside buildConfig({ ... })
db: sqliteAdapter({
  client: {
    url: process.env.DATABASE_URL || '',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
}),
```

Rules:

1. **Never add `transactionOptions: {}`** to the SQLite adapter. Payload keeps transactions off for SQLite by default because they cause database locking, which shows up as failed or hanging saves.
2. Keep the env variable name the generated config uses (`DATABASE_URL` in 3.94).
3. Local development uses a file: `DATABASE_URL=file:./payload.db`. Production uses Turso: `DATABASE_URL=libsql://<db>-<org>.turso.io` plus `DATABASE_AUTH_TOKEN`.
4. Development uses push mode (schema syncs automatically). Production uses migrations only. Never point a dev server at the production database; push mode and migrations on the same database corrupt the migration history.
5. Never use a `file:` database on Vercel. The filesystem is read-only and resets on every deploy.

## Step 4: Environment variables

Write `.env.example` with names and placeholders, and keep real values in `.env` (gitignored by the template).

```bash
PAYLOAD_SECRET=generate-a-long-random-string
DATABASE_URL=file:./payload.db
DATABASE_AUTH_TOKEN=
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
PREVIEW_SECRET=generate-a-long-random-string
CRON_SECRET=generate-a-long-random-string
```

Other skills add their own variables to this file. Generate secrets with `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`.

## Step 5: Data model

1. Read the features list in `PROJECT.md` and the inventory (if a frontend existed).
2. Map content to collections and globals using [references/data-model.md](references/data-model.md).
3. For field options, hooks, and access control syntax, read the official Payload skill. Do not guess.
4. After each schema change, run `pnpm generate:types`. After adding admin components, run `pnpm generate:importmap`.
5. Register all plugins in `src/plugins/index.ts` (the template keeps them there).

## Step 6: First run

1. `pnpm install`, then `pnpm dev`.
2. Open `http://localhost:3000/admin` and create the first user. That user gets the highest role defined by `payload-auth-rbac`.
3. In development only, the template's dashboard "Seed your database" button creates demo content. Remove the `beforeDashboard` seed component before production.
4. Commit: `feat: bootstrap Payload project`.

## Stop and ask

- The brief requires PostgreSQL or MongoDB instead of libSQL.
- The existing app uses the Pages Router (`pages/` folder) for routes that must stay.
- The Turso database or its token is not available and the phase needs production data.

## Done when

- [ ] Project created from the `website` template, or Payload installed per the reference
- [ ] `src/payload.config.ts` uses `sqliteAdapter` without `transactionOptions`
- [ ] `.env.example` lists every variable; `.env` is gitignored
- [ ] Official Payload skill present in `.agents/skills/payload` or `.claude/skills/payload`
- [ ] `pnpm generate:types` and `pnpm tsc --noEmit` pass
- [ ] `/admin` loads, a user can log in, and creating then editing a post saves without errors
