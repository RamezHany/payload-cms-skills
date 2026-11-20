#!/usr/bin/env node
// Validates every skill in skills/ against the Agent Skills format and repo rules.
// Node.js built-ins only. Exit code 1 when any error is found.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKILLS_DIR = join(ROOT, 'skills')
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MAX_NAME = 64
const MAX_DESCRIPTION = 1024
const MAX_SKILL_LINES = 500
const TOKEN_WARNING = 5000
const TEXT_EXTENSIONS = new Set(['.md', '.mdx', '.mjs', '.js', '.ts', '.tsx', '.json', '.yml', '.yaml', '.scss', '.css', '.txt', ''])
const IGNORED_DIRS = new Set(['.git', 'node_modules'])
const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

const errors = []
const warnings = []

const toPosix = (path) => relative(ROOT, path).split('\\').join('/')
const readText = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n')

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) files.push(...walk(full))
    else files.push(full)
  }
  return files
}

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return null
  const end = text.indexOf('\n---\n', 4)
  if (end === -1) return null
  const fields = {}
  let parent = null
  for (const line of text.slice(4, end).split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const nested = line.match(/^\s+([A-Za-z0-9_-]+):\s*(.*)$/)
    if (nested && parent) {
      fields[parent][nested[1]] = unquote(nested[2])
      continue
    }
    const top = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!top) return { invalidLine: line }
    const [, key, value] = top
    if (value === '') {
      fields[key] = {}
      parent = key
    } else {
      fields[key] = unquote(value)
      parent = null
    }
  }
  return { fields, body: text.slice(end + 5) }
}

function unquote(value) {
  const trimmed = value.trim()
  if (/^(['"]).*\1$/.test(trimmed)) return trimmed.slice(1, -1)
  return trimmed
}

function stripCode(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')
}

function checkLinks(file, text) {
  const linkPattern = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  for (const match of stripCode(text).matchAll(linkPattern)) {
    const target = match[1]
    if (/^(https?:|mailto:|#)/.test(target)) continue
    const path = decodeURI(target.split('#')[0])
    if (!path) continue
    if (!existsSync(resolve(dirname(file), path))) {
      errors.push(`${toPosix(file)}: broken link "${target}"`)
    }
  }
}

function checkSkill(dir, skillNames) {
  const name = dir.split(/[\\/]/).pop()
  const skillFile = join(dir, 'SKILL.md')
  if (!existsSync(skillFile)) {
    errors.push(`skills/${name}: missing SKILL.md`)
    return null
  }
  const text = readText(skillFile)
  const parsed = parseFrontmatter(text)
  if (!parsed) {
    errors.push(`skills/${name}/SKILL.md: missing or unterminated frontmatter`)
    return null
  }
  if (parsed.invalidLine) {
    errors.push(`skills/${name}/SKILL.md: unparseable frontmatter line "${parsed.invalidLine}"`)
    return null
  }
  const { fields, body } = parsed
  if (typeof fields.name !== 'string' || !fields.name) errors.push(`skills/${name}: frontmatter "name" is required`)
  else {
    if (!NAME_PATTERN.test(fields.name)) errors.push(`skills/${name}: name "${fields.name}" must be lowercase letters, digits, and single hyphens`)
    if (fields.name.length > MAX_NAME) errors.push(`skills/${name}: name exceeds ${MAX_NAME} characters`)
    if (fields.name !== name) errors.push(`skills/${name}: name "${fields.name}" must equal the folder name`)
  }
  if (typeof fields.description !== 'string' || !fields.description) errors.push(`skills/${name}: frontmatter "description" is required`)
  else if (fields.description.length > MAX_DESCRIPTION) errors.push(`skills/${name}: description is ${fields.description.length} characters (max ${MAX_DESCRIPTION})`)

  const lines = text.split('\n').length
  if (lines > MAX_SKILL_LINES) errors.push(`skills/${name}/SKILL.md: ${lines} lines (max ${MAX_SKILL_LINES})`)
  const tokens = Math.round(body.length / 4)
  if (tokens > TOKEN_WARNING) warnings.push(`skills/${name}/SKILL.md: about ${tokens} tokens; move detail into references/`)

  for (const file of walk(dir).filter((f) => extname(f) === '.md')) {
    const content = readText(file)
    checkLinks(file, content)
    for (const match of content.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)+)` skill/g)) {
      if (!skillNames.has(match[1])) errors.push(`${toPosix(file)}: references unknown skill "${match[1]}"`)
    }
  }

  const referencesDir = join(dir, 'references')
  if (existsSync(referencesDir)) {
    for (const entry of readdirSync(referencesDir)) {
      if (statSync(join(referencesDir, entry)).isDirectory()) {
        errors.push(`skills/${name}/references/${entry}: references must be one level deep`)
      }
    }
  }
  return { name, lines, tokens }
}

function checkEnglishOnly() {
  for (const file of walk(ROOT)) {
    if (!TEXT_EXTENSIONS.has(extname(file))) continue
    const lines = readText(file).split('\n')
    lines.forEach((line, index) => {
      if (ARABIC_SCRIPT.test(line)) errors.push(`${toPosix(file)}:${index + 1}: Arabic script found; repo content must be English`)
    })
  }
}

function checkRootLinks() {
  for (const file of walk(ROOT)) {
    const rel = toPosix(file)
    if (extname(file) !== '.md' || rel.startsWith('skills/')) continue
    checkLinks(file, readText(file))
  }
}

if (!existsSync(SKILLS_DIR)) {
  console.error('skills/ directory not found')
  process.exit(1)
}

const skillDirs = readdirSync(SKILLS_DIR)
  .map((entry) => join(SKILLS_DIR, entry))
  .filter((path) => statSync(path).isDirectory())
const skillNames = new Set(skillDirs.map((dir) => dir.split(/[\\/]/).pop()))
const results = skillDirs.map((dir) => checkSkill(dir, skillNames)).filter(Boolean)

checkEnglishOnly()
checkRootLinks()

console.log('Skill                              Lines  ~Tokens')
for (const { name, lines, tokens } of results) {
  console.log(`${name.padEnd(34)} ${String(lines).padStart(5)}  ${String(tokens).padStart(7)}`)
}
console.log(`\n${results.length} skills checked.`)

for (const warning of warnings) console.warn(`warning: ${warning}`)
if (errors.length) {
  for (const error of errors) console.error(`error: ${error}`)
  console.error(`\n${errors.length} error(s).`)
  process.exit(1)
}
console.log('All checks passed.')
