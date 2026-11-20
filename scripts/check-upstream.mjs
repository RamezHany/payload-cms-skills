#!/usr/bin/env node
// Compares versions.json with the npm registry and writes upstream-report.md.
// Sets drift=true in $GITHUB_OUTPUT when a major or minor version changed.

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { packages, verifiedAt } = JSON.parse(readFileSync(join(ROOT, 'versions.json'), 'utf8'))

const parse = (version) => version.split('-')[0].split('.').map(Number)

function classify(pinned, latest) {
  const [pMajor, pMinor, pPatch] = parse(pinned)
  const [lMajor, lMinor, lPatch] = parse(latest)
  if (lMajor !== pMajor) return 'major'
  if (lMinor !== pMinor) return 'minor'
  if (lPatch !== pPatch) return 'patch'
  return 'same'
}

async function latestVersion(name) {
  const response = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`)
  if (!response.ok) throw new Error(`${name}: registry returned ${response.status}`)
  const body = await response.json()
  return body.version
}

const rows = []
for (const [name, pinned] of Object.entries(packages)) {
  try {
    const latest = await latestVersion(name)
    rows.push({ name, pinned, latest, level: classify(pinned, latest) })
  } catch (error) {
    rows.push({ name, pinned, latest: 'error', level: 'error', note: error.message })
  }
}

const drifted = rows.filter((row) => row.level === 'major' || row.level === 'minor')
const failed = rows.filter((row) => row.level === 'error')

const lines = [
  '# Upstream version report',
  '',
  `Pinned versions were verified on ${verifiedAt}.`,
  '',
  '| Package | Pinned | Latest | Change |',
  '| --- | --- | --- | --- |',
  ...rows.filter((row) => row.level !== 'same').map((row) => `| \`${row.name}\` | ${row.pinned} | ${row.latest} | ${row.level} |`),
  '',
]

if (rows.some((row) => row.name === 'payload' && row.level === 'major')) {
  lines.push('**Payload has a new major version on the latest tag.** Open a migration issue before editing skills.', '')
}
if (drifted.length) {
  lines.push('Re-verify the affected skills against the new versions, then update `versions.json`.', '')
}
if (failed.length) {
  lines.push('Lookups that failed:', '', ...failed.map((row) => `- ${row.note}`), '')
}
if (!drifted.length && !failed.length) lines.push('No major or minor drift.', '')

writeFileSync(join(ROOT, 'upstream-report.md'), lines.join('\n'))
console.log(lines.join('\n'))

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `drift=${drifted.length > 0}\n`)
}
