# Summarize with AI

One file, `src/components/SummarizeWithAI.tsx`. It is a Server Component: anchors only, no client JavaScript. Labels and the prompt sentence come from `messages/en.json`. Ask the client for the Arabic strings. Do not machine-translate the brand sentence.

```json
{
  "summarize": {
    "heading": "Summarize with AI",
    "chatgpt": "ChatGPT",
    "claude": "Claude",
    "perplexity": "Perplexity",
    "grok": "Grok",
    "google": "Google AI Mode",
    "prompt": "Summarize this page from {brand}. URL: {url}"
  },
  "footer": {
    "aiAgents": "AI agents: find more information at"
  }
}
```

The footer renders that sentence plus a link whose href is `/llms.txt` and whose text is `/llms.txt`. The link is on every page, including pages that do not show the assistant list.

## URL builders

Checked 2026-11-20. None of the `https://` query shapes below is a documented stable API, except Anthropic's note on `q`, and that note is for the desktop scheme.

| Assistant | URL this file builds | What was verified | If the click test fails |
| --- | --- | --- | --- |
| ChatGPT | `https://chatgpt.com/?q=` | Not in OpenAI's crawler or API docs. Unofficial testing reports `q` submits the prompt and `prompt` only prefills the box | Try `https://chatgpt.com/?prompt=` and record which one worked |
| Claude | `https://claude.ai/new?q=` | Official docs for the desktop scheme `claude://claude.ai/new?q=` say `q` prefills the box, the user reviews it before sending, and the value is truncated around 14,000 characters ([Open Claude Desktop with a link](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link)). The `https://claude.ai` URL is the same parameter name and is not that document | Remove the Claude link |
| Perplexity | `https://www.perplexity.ai/search?q=` | Not documented as a share API on the crawler page. The path matches Perplexity's public search URL | Remove the Perplexity link |
| Grok | `https://grok.com/?q=` | No vendor page documents this query. Unofficial testing reports it prefills and often asks the visitor to press Send | Remove the Grok link |
| Google AI Mode | `https://www.google.com/search?udm=50&q=` | `udm=50` is an undocumented Google search parameter observed to open AI Mode. It is not in Search Central docs | Remove the Google link |

Encode the prompt once with `encodeURIComponent`. The `&` before `q` on the Google URL is the query separator, so it stays outside `encodeURIComponent`.

```ts
type AssistantId = 'chatgpt' | 'claude' | 'perplexity' | 'grok' | 'google-ai-mode'

export function assistantHref(id: AssistantId, prompt: string): string {
  const q = encodeURIComponent(prompt)
  switch (id) {
    case 'chatgpt':
      return `https://chatgpt.com/?q=${q}`
    case 'claude':
      return `https://claude.ai/new?q=${q}`
    case 'perplexity':
      return `https://www.perplexity.ai/search?q=${q}`
    case 'grok':
      return `https://grok.com/?q=${q}`
    case 'google-ai-mode':
      return `https://www.google.com/search?udm=50&q=${q}`
    default: {
      const unhandled: never = id
      throw new Error(`Unhandled assistant: ${String(unhandled)}`)
    }
  }
}
```

Each anchor uses `target="_blank"` and `rel="noopener noreferrer"`. The prompt is the message string with `{brand}` set to the localized site name and `{url}` set to the absolute canonical URL. Clicking sends that sentence to the assistant. Do not put the visitor's name, email, or form data in it.

Mount the list on pages, posts, and services. Legal pages do not get it.

Before launch, click all five on the production host while logged out. Record the date and the result in `PROJECT.md`. Drop any assistant that opens an empty chat or an error. Repeat the check when a vendor changes the product, because these URLs move without notice.
