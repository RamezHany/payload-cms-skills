# Runtime rules

## Reduced motion

The locale layout reads the media query once. A client island receives `reducedMotion` as a prop. When it is true:

- GSAP seeks the timeline to the end and does not play.
- Lenis is not constructed. Native scroll remains.
- A React Three Fiber canvas renders the resting camera frame and does not start an animation loop.
- Rive uses the file's resting artboard and does not autoplay.

Do not remove the section. The layout still matches the frame.

## Lenis and GSAP together

One `requestAnimationFrame` loop. Lenis drives scroll. ScrollTrigger updates from that scroll position, using the pattern in the Lenis README you installed. Do not also set `scroll-behavior: smooth` in CSS.

## Theatre.js

```ts
import { getProject } from '@theatre/core'

export const project = getProject('site')
```

The studio import lives in `src/components/motion/studio.ts` and is loaded only when `process.env.NODE_ENV === 'development'`, through `next/dynamic`. Confirm the production build's client chunks do not contain `@theatre/studio`. The studio package stays in `devDependencies`.

## React Three Fiber

The page file stays a server component. The canvas file starts with `'use client'` and is loaded like this:

```ts
import dynamic from 'next/dynamic'

export const Scene = dynamic(() => import('@/components/three/Scene'), { ssr: false })
```

`@react-three/drei` is allowed only when the scene uses a helper that package exports. Do not add it "just in case".

## Rive

Load `@rive-app/react-canvas` from the client island. The `.riv` file lives in `public/rive/`. On the free plan the export shows the Rive splash. Leave it visible. If the client refuses the splash, stop and ask. Do not patch the runtime to hide it.

## Registry fetch

One command, one name that is already written in `PROJECT.md`:

```bash
pnpm dlx shadcn@latest add @magicui/<component>
```

Replace the registry and the component with the line you recorded. If the command wants to create a full shadcn preset and the project has no `components.json`, stop. Ask before writing that file. The preset is not the design system.

After the file lands, delete any demo-only `fetch` of a font, a tracking pixel, or a remote stylesheet.
