# Test catalog

Copy the assertions. Where a collection field name or a function export differs, use the project's name. Do not skip an assertion because the fixture was inconvenient, and do not mark a required field optional so a create succeeds.

Shared rules:

- Import the template helpers from `tests/helpers/login.ts` and `tests/helpers/seedUser.ts`.
- E2E URLs stay absolute (`http://localhost:3000/...`), matching the template. The template config has no `baseURL`.
- Admin labels in these specs assume the English admin language. Do not run them under a different admin language.
- Build documents with the required fields from that collection's config. Draft creates skip required-field validation; publish does not.
- Local API checks that act as a user pass `overrideAccess: false` and that `user`. The default (`overrideAccess: true`) skips access control and proves nothing.

## Save and persist

`tests/e2e/admin-save.e2e.spec.ts`

1. `seedTestUser()` in `beforeAll`, `cleanupTestUser()` in `afterAll`, then `login` as `testUser`.
2. Open `http://localhost:3000/admin/collections/posts/create`. The template already shows that the create route redirects to a document id once autosave runs. Wait for `input[name="title"]`.
3. Fill the title with a unique string, for example `Persist title 1710000000000`. Fill every other field the collection requires before publish.
4. Save a draft with the button whose accessible name is `Save draft`. Reload the page. The title input's value is the string you typed.
5. Publish with the button named `Publish`. Wait until the document status shows published.
6. Open the public URL for that slug. On a localized site that is `http://localhost:3000/<defaultLocale>/posts/<slug>`. The page contains the title.
7. Change one word, save as draft again, and reload the public URL. The public page still shows the published title, not the draft edit.

If `Publish` stays disabled, the collection still has an empty required field. Read the collection config. Do not click a different button to force it.

## Upload

`tests/e2e/media-upload.e2e.spec.ts`

Skip the test, with a message, when neither Cloudinary nor R2 env vars are set (`CLOUDINARY_CLOUD_NAME`, or `R2_BUCKET` together with `R2_PUBLIC_URL`). CI does not have those secrets. Delivery still requires one local run with them set.

When they are set:

1. Log in the same way as the save spec.
2. Put a JPEG of at least 200 KB at `tests/fixtures/photo.jpg`. A tiny file can stay in its original format, because the `payload-media` skill keeps the original when the optimized result is not smaller. Do not commit a client's private photo.
3. Open the media create view, set the file input with `setInputFiles`, fill the required `alt` text, and save.
4. After the document reloads, the stored filename ends in `.webp` and the URL field contains the provider host (`res.cloudinary.com`, or the host of `R2_PUBLIC_URL`).

## Live preview

`tests/e2e/live-preview.e2e.spec.ts`

1. Log in and open an existing published post in the admin (create one in `beforeAll` through the Local API on the e2e database if the list is empty).
2. Locate the preview iframe. Its `src` contains `/next/preview`.
3. Change the title input to a new unique string.
4. Within 15 seconds the iframe text contains that string, without a manual publish. Autosave is 100 ms; the listener refreshes the route. The `payload-live-preview` skill describes that path.

A blank iframe is a header failure, not a flaky timeout. Use the diagnosis table before raising the timeout.

## Locale sync

`tests/e2e/locale-sync.e2e.spec.ts`

Skip, with a message, when `src/i18n/locales.ts` exports fewer than two locales.

1. Log in and open a localized post.
2. Switch the document locale to the locale whose label is `Arabic` (the English label from `localeLabels`, code `ar`).
3. The admin document element has `dir="rtl"`.
4. The preview iframe `src` contains `/ar`.
5. Switch back to `English`. `dir` is `ltr` and the iframe `src` contains `/en` (or the project's default locale code).

Do not assert on translated sentences. Assert the locale code and `dir`.

## Access matrix

`tests/int/access.int.spec.ts`

Create users through the Local API with the default override (so field access does not block the fixture). Create the admin user first: the first-user hook in the `payload-auth-rbac` skill forces `role: 'admin'`. Then create `editor` and `sales`. Pass `name`, `email`, `password`, and `role`.

Run every later call with `overrideAccess: false`.

For each collection the project actually registers, assert the cells below. Skip a slug the project does not define. Fail the spec if `PROJECT.md` lists a role matrix and a collection from that matrix has no case.

| Collection or global | Allow | Deny |
| --- | --- | --- |
| `users` | admin create; a user reads and updates their own document | editor creates a user; a user reads another user; anonymous read |
| `pages`, `posts`, `legal-pages`, `categories`, `services` | editor create, read, update, delete; anonymous `find` returns a published doc | sales create; anonymous `find` returns a draft |
| `media` | editor create; anonymous read | sales create |
| `leads` | sales read and update | editor read; anonymous create |
| `bookings` | sales read and update | editor read; anonymous read; sales create |
| `payment-events` | admin read | editor read; sales read; admin create (the matrix grants read only) |
| `header` | editor `updateGlobal` | sales `updateGlobal` |
| `booking-settings` | admin `updateGlobal` | sales `updateGlobal` |

Use draft documents for create, update, and delete checks so required publish fields do not hide an access bug. Use one published post and one draft post for the anonymous `find` check.

An allowed call resolves. A denied call rejects. Do not accept an empty `find` as proof of denial when the access function returns `false`: Payload rejects that operation. A filtered `find` (published-only) resolves and must be asserted by which documents came back.

After a non-admin updates their own user, read the user back as admin and assert `role` is unchanged.

If `PROJECT.md` changed a cell, change the matching assertion and leave the others.

## Payment signatures

`tests/int/payments.int.spec.ts`

Skip the file, with a reason, when `PROJECT.md` enables no payment gateway.

There is no shared `verifyWebhookSignature` helper. Each provider exports `verifyWebhook(request, rawBody)` and returns `null` when the signature is wrong (`payload-bookings-payments` references/provider-interface.md). Stripe goes through `stripe.webhooks.constructEvent` inside that method. Do not reimplement an HMAC in the test.

Copy only vectors that a provider reference actually publishes. Do not invent a digest, and do not hash a string with the project code and then store that hash as the expected value.

| Provider | What the spec asserts | Where the vector is |
| --- | --- | --- |
| Kashier | The session path `/?payment=mid-0-1.99.20.EGP` with key `11111` digests to the hex in `references/kashier.md`, and the webhook canonical string on that page digests to the other hex. Call the project's digest function. Then call `verifyWebhook` with one character changed in `x-kashier-signature` and expect `null`. | `references/kashier.md` |
| Paymob | The concatenation of the published processed-callback sample equals the string in `references/paymob.md`. Do not assert an HMAC hex. That page does not include the secret. A `verifyWebhook` call whose `hmac` query value has one flipped character returns `null`. | `references/paymob.md` |
| Fawry, Tap | No numeric vector is published in those references. Assert only the tamper case: `verifyWebhook` returns `null`. | `references/fawry.md`, `references/tap.md` |
| PayPal | That reference says there is no published numeric vector. Assert only the tamper case. | `references/paypal.md` |
| Stripe | Assert the tamper case through `verifyWebhook` (a header that is not a Stripe signature yields `null`). Do not hand-roll the Stripe HMAC. | `references/stripe.md` |

Run a row only for providers the project enabled. A missing digest function for Kashier or a missing concatenation function for Paymob is a failure: export the function the provider file already uses, and call that. Do not copy the algorithm into the test.

## Webhook idempotency

`tests/int/webhooks.int.spec.ts`

Skip with a reason when the project has no bookings. Otherwise call the provider route twice. Do not add a second idempotency implementation in the test.

1. Create a booking with `status: 'pending_payment'` through the Local API, using the fields in `payload-bookings-payments` references/booking-model.md (`slotKey`, `holdExpiresAt`, `amountMinor`, `currency`, `publicToken`).
2. Build one webhook request whose signature `verifyWebhook` accepts (a Kashier vector is the one with a published digest). Mock `after` from `next/server` so it does not run `fulfillBooking`; that callback sends mail and talks to Google, and it throws outside a Next.js request. The booking update itself is synchronous.
3. `POST` the same raw body and headers to `src/app/api/webhooks/<provider>/route.ts` twice.
4. The booking `status` is `confirmed`. `payment-events` filtered by that `providerEventId` has `totalDocs` of 1. The second response is 200.

A unique-constraint throw on the second insert is acceptable only if the route catches it, returns 200, and leaves a single row. The spec asserts that outcome.
