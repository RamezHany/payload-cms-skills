---
name: creative-frontend
description: Add free motion, 3D, and copied UI components to a Payload Next.js site. Use for GSAP, Lenis, Motion, Theatre.js, Rive, three.js, React Three Fiber, Uiverse, React Bits, Cult UI, Magic UI, Animate UI, Aceternity UI, hover.dev, 21st.dev, recent.design, or a Codrops demo. Checks the license and free tier before any install or copy. Paid and Pro components stay out.
license: MIT
metadata:
  version: "1.0.0"
---

# Creative frontend

Add an effect only when a frame or the brief asks for it. The default page is server-rendered and still. This skill does not replace the `figma-handoff` skill and does not install a design system.

## Step 1: Pass the license gate

Open [references/licenses.md](references/licenses.md). Find the library. If its row says stop, stop. If the row tells you to open a page, open that page in this session and read the license before you copy or install.

Then write one line under `## Design` in `PROJECT.md` for every library you will use:

`2026-11-20: <library> <component or package> — <license> — <source URL>`

Use today's date. Paid, Pro, All-access, and unlicensed items do not get a line and do not get installed.

The shadcn CLI may fetch one named component only when that line exists. Never `shadcn init` as the base design system. Never `add --all`. Never a Pro registry.

## Step 2: Pick one motion runtime

| Need | Package | Where |
| --- | --- | --- |
| Timeline, scroll scene | `gsap` and `@gsap/react` | `src/components/motion/` |
| Smooth scroll | `lenis` | one instance beside the locale layout |
| Small React gestures | `motion` (`motion/react`) | the section that needs it |
| Editor for a scene | `@theatre/core` in production, `@theatre/studio` in development only | `src/components/motion/theatre.ts` |
| 3D | `three` and `@react-three/fiber` | `src/components/three/`, loaded with `next/dynamic` and `ssr: false` |
| Vector animation | `@rive-app/react-canvas` | `src/components/rive/` |

Do not install `framer-motion`. Do not run GSAP and Motion on the same element. Do not put a canvas, a Rive file, or Theatre studio in the root layout.

`@theatre/studio` is a devDependency. Import it only from a file that production does not include. Details: [references/runtime.md](references/runtime.md).

## Step 3: Respect reduced motion and cost

1. Read `prefers-reduced-motion: reduce` before starting a timeline, Lenis, or a self-playing canvas. Reduced motion gets the final frame, not an empty box.
2. Animate `transform` and `opacity`. Do not animate `top`, `left`, `width`, or `height`.
3. The 3D and Rive islands are client components. The page around them stays a server component.
4. Images inside a section still go through the `payload-media` skill. Do not add a second image pipeline.
5. A copied component that fetches its own font or analytics is rejected. Remove that code before shipping.

## Step 4: Install in the website, not in this skills repo

From the website project:

```bash
pnpm view <package> version
pnpm add <package>
```

Record the version you installed in the Design line. Do not add these packages to this skills repository's `versions.json`. They are optional and they are not the Payload stack.

Copy a registry component into `src/components/ui/<Name>.tsx` or `src/components/sections/<Name>.tsx`. Keep the copyright notice the license requires. One component per command.

## Stop and ask

- The license page did not load, or the component is marked Pro, premium, or All-access.
- recent.design has no license on the component you need.
- A 21st.dev copy would need a paid membership, or the component's own license is missing.
- The free Rive plan's splash screen is unacceptable to the client.
- Theatre studio would be imported from a production page.

## Done when

- [ ] Every library and component has a Design line with a license and a source URL
- [ ] No Pro package and no Pro registry item is in `package.json` or `src/`
- [ ] Reduced motion shows the final frame
- [ ] `@theatre/studio` is not in the production bundle
- [ ] `pnpm build` still succeeds
