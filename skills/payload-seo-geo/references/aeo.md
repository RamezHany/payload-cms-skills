# Answer-first pages

Apply this on posts and services. It is editorial structure, not a markup trick.

1. Under the title, write two or three sentences that answer the page's question. A person, and an agent that only reads the top of the page, should get the point without scrolling.
2. Use headings that are questions the page actually answers (`How long does a consultation take?`). The heading and the paragraph under it must agree.
3. Show the author name and the published date in the article header. Show the updated date when `updatedAt` or `lastUpdated` is later than the published date. Those visible strings are the ones `BlogPosting` uses for `datePublished` and `dateModified`.
4. Use one name, one address, and one phone, all from site-settings, in the footer and in the schema. A second spelling of the business name belongs in `legalName` only when the legal entity differs, and the page says so.
5. Link to the related service, the relevant legal page, and two or three other posts with ordinary anchor text. The link describes the destination.
6. Write the title and description for a person who will read them in a search result. One description, under about 160 characters. Do not repeat the keyword in the title, the headings, and the first sentence.

FAQ blocks on a marketing page are optional. Add `FAQPage` only when those questions and answers are visible, and expect no FAQ rich result (see the JSON-LD reference).

`/llms.txt` stays useful when the one-line description is the same answer as the opening sentences, not a slogan.
