---
name: figma-handoff
description: Turn a Figma file into the Payload CMS frontend. Use when the brief includes a Figma link, a frame, or a design handoff, before bootstrap or before changing an existing Next.js layout. Maps frames to locale routes, writes tokens into the existing Tailwind theme, and stops instead of inventing screens.
license: MIT
metadata:
  version: "1.0.0"
---

# Figma handoff

Build the screens that exist in the file. Do not invent pages, sections, or copy to fill gaps.

## Step 1: Record the file

1. Load the `agent-guardrails` skill.
2. Read `PROJECT.md`. Under `## Design`, set `Figma file` to the URL the client gave. If there is no URL, stop and ask. Do not search the web for a similar design.
3. From a `figma.com/design/<fileKey>/...` URL, keep `fileKey`. If the URL has `node-id`, convert `-` to `:` and keep that node. A branch URL uses the branch key as the file key.

## Step 2: Read the frames

Use the Figma tools available in this session (a file session, then the frame's layout and text). Read the frames the brief names. If the brief names none, read the pages marked for the website, not the cover or the archive.

If no Figma tool is available, stop. Ask the client for the frames or for a Dev Mode export. Do not rebuild the site from a screenshot description you were not given.

Write a frame map in `PROJECT.md` under `## Design` before editing React. Columns: frame name, route, locale, notes. The route pattern is in [references/frame-map.md](references/frame-map.md).

## Step 3: Put the frontend in the standard folders

Follow the `project-architecture` skill first.

| What you found | Where it goes |
| --- | --- |
| A page frame | `src/app/(frontend)/[locale]/...` |
| A repeating section | `src/components/sections/<Name>.tsx` |
| A small control used on more than one page | `src/components/ui/<Name>.tsx` |
| Brand SVG | `public/brand/` |

Pages compose sections. Do not paste a whole frame into `page.tsx`.

If the app is not Next.js yet, stop after the frame map and follow scenario C in the `payload-project-kickoff` skill. Do not start a second frontend.

## Step 4: Tokens go in the theme that already exists

Read colors, type, radius, and spacing from the variables or from the frame, and write the hex values and font names into `PROJECT.md`.

Put them in the Tailwind theme the project already uses (`src/app/(frontend)/globals.css` or the file the architecture skill names). Do not add a second theme, a second CSS framework, or a shadcn preset as the base design system.

The shadcn CLI may fetch one named registry component only when `PROJECT.md` lists that exact component. That fetch is the `creative-frontend` skill, not this one.

## Step 5: Match the frame, then stop

1. Implement one frame at a time, in the order of the map.
2. Use the frame's text. Do not rewrite headlines.
3. Images in the file are placeholders until the client supplies files. Use the `payload-media` skill for real images. Do not hotlink Figma URLs from the website.
4. If a locale is RTL, the localized layout sets `dir`. Do not hardcode a left-to-right page for Arabic.
5. Desktop and the narrow frame, when the file has one. If the file has no narrow frame, stop and ask before inventing a mobile layout.

Motion, 3D, or a copied component waits for the `creative-frontend` skill. A static section that matches the frame is enough for this skill.

## Stop and ask

- The Figma URL is missing, or the tools cannot open the file.
- A frame has no route in the brief.
- The file contradicts `PROJECT.md` (an extra language, a payment step, a page the brief does not mention).
- You would need a paid Figma plan or a paid component to match the frame.

## Done when

- [ ] `PROJECT.md` has the file URL, the hex colors, the font names, and the frame map
- [ ] Every implemented route is a row in that map
- [ ] No route exists that the map does not list
- [ ] Tokens live in the existing theme file
- [ ] The next skill is named: `payload-bootstrap` for a new site, or the feature skill for a site that already has Payload
