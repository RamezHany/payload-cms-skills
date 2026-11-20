# PROJECT

Single source of truth for this project. Agents read it at the start of every session and update it at the end.

## Client

- Name: TBD
- Website domain: TBD
- Industry: TBD
- Contact for decisions: TBD

## Brief

Paste or summarize the client brief here. Link client documents.

## Scenario

One of: A. New site / B. Backend for an existing frontend / C. Migrate to Next.js / D. Feature or fix

## Design

- Figma file: TBD
- Brand colors (hex): TBD
- Fonts: TBD
- Logo files: `public/brand/` (SVG preferred)
- Approved animation and component libraries: TBD (list each library and the exact components)

## Languages

- Content locales: en (default)
- RTL locales: none
- Admin languages: en

## Features

Check what the client needs.

- [ ] Blog with live preview
- [ ] Pages builder with live preview
- [ ] Contact or lead forms with simple CRM
- [ ] Consultation booking
- [ ] Online payments (gateway: TBD)
- [ ] Google Calendar sync
- [ ] Video (Mux / Vimeo / YouTube)
- [ ] Newsletter
- [ ] MCP endpoint for the client
- [ ] Legal pages (privacy, terms, cookies, refunds, copyright, do not sell, trust center)
- [ ] Summarize with AI footer links and `/llms.txt`

## Services and accounts

Record which accounts exist. Never write secret values here; secrets go in `.env.local` and the hosting dashboard.

| Service | Account owner | Status |
| --- | --- | --- |
| Vercel | TBD | TBD |
| Turso | TBD | TBD |
| Cloudinary or R2 | TBD | TBD |
| Mux | TBD | TBD |
| Resend or Mailgun | TBD | TBD |
| Payment gateway | TBD | TBD |
| Google Cloud (Calendar, Sheets, Drive) | TBD | TBD |
| Google Search Console | TBD | TBD |

## Phases

- [ ] 1. Architecture - skill: project-architecture - Done when: TBD

## Decisions

Record decisions with a date, for example: `2026-01-15: Use Kashier instead of Paymob (client request).`

## Questions

Open questions for the client or the developer. Agents add questions here instead of guessing.

## Blockers

Problems an agent could not solve after the attempts allowed by the guardrails.

## Session log

Newest entry first. Each entry: date, model, what was done, what is not done, next step.
