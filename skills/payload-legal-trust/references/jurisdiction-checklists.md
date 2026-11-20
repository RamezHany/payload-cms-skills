# Jurisdiction checklists

These are questions for the client and their lawyer. They are not policy text, not a compliance opinion, and not a substitute for the official text. Record the answers in `PROJECT.md`. Where a point below cites a statute, confirm it against the official text before anyone relies on it.

## Egypt

Law No. 151 of 2020 on the Protection of Personal Data. An English text is on [ILO NATLEX](https://natlex.ilo.org/dyn/natlex2/natlex2/files/download/111246/EGY111246%20Eng.pdf). That file is a translation. The Arabic text in the Official Gazette controls.

Law-firm translations describe executive regulations issued as Ministry of Communications and Information Technology Decision No. 816 of 2025. Confirm that number and the current text in the Official Gazette before citing it. This skill does not quote those translations into the site.

Ask counsel to cover, for this site:

- Whether the operator is a controller, a processor, or both, and whether a license or permit from the Data Protection Center is required for the processing they do.
- Which collections require the data subject's explicit consent, and which cases the law allows without it (Article 2 of the 2020 law, in the NATLEX translation, starts from explicit consent or another case the law permits).
- The rights in that Article 2 translation: access, withdrawal of consent, correction or deletion, limiting processing to a purpose, notice of a breach, and objection. Ask which of these the site must offer and how `dataRequestEmail` should respond.
- Sensitive data. The translation treats health, genetic, biometric, financial, religious, political, and criminal-record data as sensitive, and treats children's data as sensitive. Ask whether any form collects these, and what guardian consent is required.
- Direct electronic marketing: purpose, no disclosure of contact details, and a record of consent. Ask before any marketing category cookie or email campaign.
- Cross-border transfer. Hosting on Vercel, Turso, or a non-Egypt storage region is a transfer. Ask whether a permit is required and what the privacy policy must say.
- Retention periods and the fee, if any, the Center allows for handling a rights request. Do not invent a fee.

## GDPR and ePrivacy

Ask whether the site offers goods or services to people in the EEA, or monitors their behavior. Counsel applies Regulation (EU) 2016/679 and, for cookies, Directive 2002/58/EC as implemented in the relevant country. When the answer is yes, ask them to name:

- The lawful basis for each processing purpose the site actually performs.
- The notice items in Articles 13 and 14 that the privacy page must contain.
- Which rights the contact channel must handle (access, rectification, erasure, restriction, portability, objection).
- Whether each vendor in the trust center is a processor that needs an Article 28 contract, and which transfer tool in Chapter V applies.
- Whether a representative or a data protection officer is required.
- The supervisory authority for complaints.

The cookie banner in this skill is opt-in, defaults to denied, and loads tags after a choice. That is the implementation. Whether it is enough for a given country is the lawyer's conclusion. Do not write "GDPR compliant" from this list.

## Gulf

Ask which countries the operator is established in or markets to. Then ask counsel to name the current statute. Do not copy a summary into the privacy page.

Commonly cited starting points, which counsel must confirm against the current official text, including amendments:

- United Arab Emirates: Federal Decree-Law No. 45 of 2021 concerning the Protection of Personal Data.
- Saudi Arabia: the Personal Data Protection Law and its Implementing Regulations.

For Qatar, Bahrain, Kuwait, or Oman, ask counsel to name the statute. Do not supply one from memory.

## What the page may say

After counsel answers, the privacy page states those answers in the lawyer's words: who the controller is, the purposes, the vendors, the countries, the retention periods, and the contact. The trust center table matches that vendor list. The cookie policy matches the tools that actually load.
