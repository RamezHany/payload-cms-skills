# AI crawler tokens

Re-read the vendor pages before shipping. The tokens below were checked on 2026-11-20. A new bot since that date is missing from this table until you add it from the vendor page.

| Token | Purpose | robots.txt, as the vendor describes it | Source |
| --- | --- | --- | --- |
| `GPTBot` | Crawls content that may train OpenAI foundation models | Disallow means do not use the content for training | [OpenAI crawlers](https://developers.openai.com/api/docs/bots) |
| `OAI-SearchBot` | Surfaces sites in ChatGPT search | Disallow keeps the site out of ChatGPT search answers. It can still appear as a navigational link | Same |
| `ChatGPT-User` | User-triggered fetches from ChatGPT and Custom GPTs | OpenAI says robots.txt rules may not apply, because a person initiated the fetch. Not used to decide Search inclusion | Same |
| `OAI-AdsBot` | Checks landing pages of ads submitted to ChatGPT. Not used for training | Leave it allowed unless the client asks to block it. It is not part of the three policies below | Same |
| `ClaudeBot` | Collects content that may train Anthropic models | Disallow means future material should be excluded from training. A group that names `ClaudeBot` wins over a general rule | [Anthropic crawlers](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) |
| `Claude-SearchBot` | Indexes content for Claude search quality | Disallow reduces visibility in Claude search | Same |
| `Claude-User` | Fetches pages when a person asks Claude | Anthropic says the token controls user-initiated retrieval and that its bots honor robots.txt | Same |
| `PerplexityBot` | Indexes pages for Perplexity search. Perplexity says it is not used to train foundation models | Disallow means the full or partial text is not indexed. Perplexity may still keep the domain, headline, and a short factual summary | [Perplexity crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) |
| `Perplexity-User` | Fetches a page when a person asks Perplexity | Perplexity says this fetcher generally ignores robots.txt | Same |
| `Google-Extended` | Control token, not a separate crawler. Decides whether content Google already crawled may train future Gemini models and may ground answers in Gemini apps and Vertex AI | Does not change Google Search inclusion or ranking. Disallow also opts out of grounding | [Google common crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) (page updated 2026-10-30) |
| `Applebot-Extended` | Control token. Decides whether content Applebot crawled may train Apple foundation models | Applebot-Extended does not itself crawl. Disallow still allows Apple search | [About Applebot](https://support.apple.com/en-us/119829) |
| `CCBot` | Common Crawl's crawler (`CCBot/2.0`) | `Disallow: /` stops the crawl. It does not remove data already published in a past crawl | [CCBot](https://commoncrawl.org/ccbot) |

Do not disallow `Googlebot` or `Applebot` as part of an AI policy. `Google-CloudVertexBot` is a different token (crawls a site owner requests for Vertex AI Agents) and stays allowed.

## Which tokens each policy names

`allow-all` adds no AI group.

`allow-answer-block-training` disallows: `GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`.

It adds an allow group (still disallowing `/admin`) for: `OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`, `Perplexity-User`.

`block-all` disallows `/` for every token in both lists. `Googlebot` and `Applebot` remain on the `*` rule.

Tell the client, in writing in `PROJECT.md`, that `Google-Extended` covers grounding as well as training, and that `ChatGPT-User` and `Perplexity-User` may ignore the file.

## robots.ts

Set `generateRobotsTxt: false` in `next-sitemap.config.cjs`. Delete `public/robots.txt` if a previous build wrote it.

`src/app/(frontend)/robots.ts`:

```ts
import type { MetadataRoute } from 'next'

import { getSiteSettings } from '@/globals/SiteSettings/getSiteSettings'
import { defaultLocale } from '@/i18n/locales'

type AiCrawlerPolicy = 'allow-all' | 'allow-answer-block-training' | 'block-all'

const TRAINING = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot']
const ANSWER = ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User']

function isPolicy(value: string | null | undefined): value is AiCrawlerPolicy {
  return value === 'allow-all' || value === 'allow-answer-block-training' || value === 'block-all'
}

function aiRules(policy: AiCrawlerPolicy): MetadataRoute.Robots['rules'] {
  switch (policy) {
    case 'allow-all':
      return []
    case 'allow-answer-block-training':
      return [
        ...TRAINING.map((userAgent) => ({ userAgent, disallow: '/' })),
        ...ANSWER.map((userAgent) => ({ userAgent, allow: '/', disallow: '/admin' })),
      ]
    case 'block-all':
      return [...TRAINING, ...ANSWER].map((userAgent) => ({ userAgent, disallow: '/' }))
    default: {
      const unhandled: never = policy
      throw new Error(`Unhandled AI crawler policy: ${String(unhandled)}`)
    }
  }
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSiteSettings(defaultLocale).catch(() => null)
  const raw = settings?.aiCrawlerPolicy
  const policy = isPolicy(raw) ? raw : 'allow-all'
  const siteUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
  const sitemapPaths = ['/pages-sitemap.xml', '/posts-sitemap.xml']
  // Push '/legal-pages-sitemap.xml' and '/services-sitemap.xml' when those routes exist.

  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/admin' }, ...aiRules(policy)],
    sitemap: sitemapPaths.map((path) => `${siteUrl}${path}`).filter((url) => url.startsWith('https://')),
  }
}
```

List a sitemap URL only when that route exists. `getSiteSettings` is cached with `global_site-settings`, so a policy change refreshes robots.txt without a path-wide layout revalidation.

RFC 9309 uses the most specific user-agent group and does not merge it with `*`. That is why an allow group repeats `Disallow: /admin`.
