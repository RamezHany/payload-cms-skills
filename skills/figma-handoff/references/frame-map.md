# Frame map

Copy this table into `PROJECT.md` under `## Design`. One frame per row. A component frame (a button, a card) is not a route; note it in the route cell as `component`.

| Frame | Route | Locale | Notes |
| --- | --- | --- | --- |
| Home | `/[locale]` | all | |
| Blog index | `/[locale]/posts` | all | |
| Blog post | `/[locale]/posts/[slug]` | all | |
| Service | `/[locale]/services/[slug]` | all | |
| Booking | `/[locale]/book` | all | |
| Legal | `/[locale]/legal/[slug]` | all | |

Routes live under `src/app/(frontend)/[locale]/`. The `[locale]` segment is required when the `payload-localization` skill is in the plan. API routes stay outside `[locale]`.

The home page is `page.tsx` in `[locale]`, not `[slug]` with the value `home`.

A frame named for the admin panel is out of scope. Admin branding is the `payload-admin-branding` skill.
