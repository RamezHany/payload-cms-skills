# Template test setup

Edit the files the website template already has. Do not add `jest.config`, a second Playwright config, or `src/__tests__`.

Verified against the website template on the Payload `3.x` branch:

- `playwright.config.ts` uses `testDir: './tests/e2e'`, `forbidOnly` and `retries: 2` when `CI` is set, `workers: 1` on CI, the `html` reporter, one Chromium project with `channel: 'chromium'`, and `webServer: { command: 'pnpm dev', reuseExistingServer: true, url: 'http://localhost:3000' }`. It does not set `baseURL`. The template specs use absolute `http://localhost:3000` URLs. Keep that.
- `vitest.config.mts` uses `environment: 'jsdom'`, `setupFiles: ['./vitest.setup.ts']`, and `include: ['tests/int/**/*.int.spec.ts']`.
- `vitest.setup.ts` only loads `dotenv/config`.
- `package.json` scripts: `test`, `test:int` (`vitest run --config ./vitest.config.mts`), `test:e2e` (`playwright test --config=playwright.config.ts` with `tsx` registered). Call those scripts. Do not invoke the binaries with a different config.
- `tests/helpers/login.ts` fills `#field-email` and `#field-password`, submits `button[type="submit"]`, and waits for `/admin`.
- `tests/helpers/seedUser.ts` creates `dev@payloadcms.com` / `test` through the Local API.
- `tests/e2e/admin.e2e.spec.ts` uses `input[name="title"]` on the pages create view.

`reuseExistingServer: true` means Playwright will talk to a dev server that is already on port 3000 and will ignore `webServer.env`. Stop any running `pnpm dev` before `pnpm test:e2e`, locally and in CI. CI has no server, so Playwright starts one.

## Vitest

`vitest.config.mts`, keep the existing plugins and `include`. Add the worker and setup keys:

```ts
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globalSetup: ['./tests/helpers/globalSetup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    fileParallelism: false,
    maxWorkers: 1,
  },
})
```

`tests/helpers/globalSetup.ts`:

```ts
import { mkdirSync, rmSync } from 'node:fs'

const files = ['vitest.db', 'vitest.db-journal', 'vitest.db-wal', 'vitest.db-shm']

export default function setup(): void {
  mkdirSync('.data', { recursive: true })
  for (const file of files) rmSync(`.data/${file}`, { force: true })
}
```

Replace `vitest.setup.ts`:

```ts
import 'dotenv/config'

const databaseUrl = 'file:./.data/vitest.db'
process.env.DATABASE_URL = databaseUrl
delete process.env.DATABASE_AUTH_TOKEN

if (!process.env.DATABASE_URL?.startsWith('file:')) {
  throw new Error('Refusing to run Vitest against a remote database.')
}
```

Set `DATABASE_URL` after `dotenv/config`. Dotenv does not override variables that already exist, but a developer `.env` often contains `libsql://`. Overwriting after the import is what makes the remote URL lose.

Payload enables Drizzle push in development only. Do not set `NODE_ENV=production` for `pnpm test:int`. Push creates tables on the empty file. Do not run `payload migrate` against `.data/vitest.db`.

## Playwright

At the top of `playwright.config.ts`, after `import 'dotenv/config'`:

```ts
import { mkdirSync, rmSync } from 'node:fs'

const e2eDatabaseUrl = 'file:./.data/e2e.db'

mkdirSync('.data', { recursive: true })
for (const suffix of ['', '-journal', '-wal', '-shm']) {
  rmSync(`.data/e2e.db${suffix}`, { force: true })
}

process.env.DATABASE_URL = e2eDatabaseUrl
delete process.env.DATABASE_AUTH_TOKEN

if (!process.env.DATABASE_URL.startsWith('file:')) {
  throw new Error('Refusing to run Playwright against a remote database.')
}
```

Pass the same URL to the dev server. Build the env object without `DATABASE_AUTH_TOKEN`:

```ts
const serverEnv = { ...process.env, DATABASE_URL: e2eDatabaseUrl }
delete serverEnv.DATABASE_AUTH_TOKEN

// inside defineConfig, keep every other webServer field from the template
webServer: {
  command: 'pnpm dev',
  reuseExistingServer: true,
  url: 'http://localhost:3000',
  env: serverEnv,
},
```

`seedTestUser` imports the Payload config in the Playwright process, so it uses the URL set above. The dev server uses `serverEnv`. They must match. If they diverge, login fails because the user was seeded into a different file.

## Gitignore and the seed user

Add these lines to `.gitignore` if they are missing:

```text
.data/
*.db
*.db-journal
*.db-wal
*.db-shm
```

When the users collection requires `name` (see the `payload-auth-rbac` skill), pass `name: 'Test Admin'` in `tests/helpers/seedUser.ts`. Keep the template email and password. The first user in an empty database becomes `admin` via that skill's hook, which is why the e2e file is deleted at the start of the run.

## What not to change

- Do not set `channel` to something else to silence a missing-browser error. Install the browser with `pnpm exec playwright install --with-deps chromium`.
- Do not point `testDir` or `include` at a new folder.
- Do not add a MongoDB or Postgres service to CI. This project uses the SQLite adapter.
