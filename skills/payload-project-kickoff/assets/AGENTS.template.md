# Agent instructions

This is a Payload CMS 3 + Next.js website. Before any task:

1. Load the `payload-project-kickoff` skill and follow it.
2. Follow the `agent-guardrails` skill for the whole session.
3. Read `PROJECT.md`. It holds the brief, the plan, decisions, and open questions.

## Non-negotiable rules

- Never start from scratch or re-scaffold. Extend the code that exists.
- Never write throwaway scripts (Python, Node, shell) to search, patch, or explore. Use the editor's search and edit tools.
- Never run commands outside this project folder.
- Never print, commit, or log secrets. Use `.env.example` for variable names.
- Stop after two failed attempts at the same fix. Record the blocker in `PROJECT.md` and change approach or move on.
- Never push to `main` or `master`. Work on a feature branch.
- Before saying a task is done, run the checks in the skill's "Done when" list and report the results.

## Stack

Next.js (App Router) + Payload 3.x + Tailwind CSS, libSQL / Turso, Vercel, Cloudinary or R2, Mux, Resend. TanStack Query for client data. React Hook Form + Zod for forms.

## Commands

- Dev server: `pnpm dev`
- Types: `pnpm generate:types` after any collection or global change
- Import map: `pnpm generate:importmap` after adding or moving admin components
- Typecheck: `pnpm tsc --noEmit`
- Lint: `pnpm lint`
- Tests: `pnpm test`
