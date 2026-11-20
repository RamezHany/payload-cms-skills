# Security Policy

## Scope

This repository contains instructions and code snippets that agents copy into production websites. A security issue here is any instruction or snippet that leads to:

- missing or incorrect webhook signature verification
- secrets exposed to the browser or committed to a repository
- access control that lets anonymous users read or write protected data
- unsafe shell behavior in agent guardrails

## Reporting

Do not open a public issue for a vulnerability. Email rramezhany@gmail.com with:

- the skill and file path
- what goes wrong and the impact
- a suggested fix, if you have one

You will get a reply within 7 days. Fixes ship as a patch release with credit unless you ask otherwise.

## Supported versions

Only the latest release on `master` is supported.
