#!/usr/bin/env node
// Stdio MCP server for this skills library. Node.js built-ins only.
// Logs go to stderr. Stdout is newline-delimited JSON-RPC and nothing else.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKILLS_DIR = join(ROOT, 'skills')
const SUPPORTED_PROTOCOLS = ['2025-03-26', '2024-11-05']
const SERVER_INFO = { name: 'payload-cms-skills', version: '1.1.0' }

const TOOLS = [
  {
    name: 'list_skills',
    description: 'List every skill in this repository with its description. Call this before read_skill.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'read_skill',
    description: 'Read one skill SKILL.md by its folder name, plus the reference filenames it ships.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Skill folder name, for example payload-live-preview.' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'read_reference',
    description: 'Read one references/*.md file from a skill. The file argument is the basename, not a path.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Skill folder name.' },
        file: { type: 'string', description: 'Reference basename, for example licenses.md.' },
      },
      required: ['name', 'file'],
      additionalProperties: false,
    },
  },
]

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return ''
  const end = text.indexOf('\n---\n', 4)
  if (end === -1) return ''
  for (const line of text.slice(4, end).split('\n')) {
    const match = line.match(/^description:\s*(.*)$/)
    if (match) {
      const value = match[1].trim()
      if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1)
      return value
    }
  }
  return ''
}

function skillNames() {
  return readdirSync(SKILLS_DIR)
    .filter((entry) => statSync(join(SKILLS_DIR, entry)).isDirectory())
    .sort()
}

function assertSkill(name) {
  if (typeof name !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    throw new Error('Skill name must be a lowercase folder name.')
  }
  const dir = join(SKILLS_DIR, name)
  if (!existsSync(join(dir, 'SKILL.md'))) throw new Error(`Unknown skill: ${name}`)
  return dir
}

function listSkills() {
  return skillNames()
    .map((name) => {
      const text = readFileSync(join(SKILLS_DIR, name, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n')
      return `${name}: ${parseFrontmatter(text)}`
    })
    .join('\n')
}

function readSkill(name) {
  const dir = assertSkill(name)
  const body = readFileSync(join(dir, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n')
  const referencesDir = join(dir, 'references')
  const references = existsSync(referencesDir)
    ? readdirSync(referencesDir).filter((file) => file.endsWith('.md')).sort()
    : []
  const listing = references.length ? references.join(', ') : 'none'
  return `${body}\n\nReference files: ${listing}\nRead one with read_reference name=${name} file=<basename>.`
}

function readReference(name, file) {
  if (typeof file !== 'string' || !/^[a-z0-9-]+\.md$/.test(file)) {
    throw new Error('File must be a basename such as licenses.md.')
  }
  const dir = assertSkill(name)
  const path = join(dir, 'references', file)
  if (!existsSync(path)) throw new Error(`No reference ${file} on ${name}.`)
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
}

function callTool(name, args) {
  switch (name) {
    case 'list_skills':
      return listSkills()
    case 'read_skill':
      return readSkill(args.name)
    case 'read_reference':
      return readReference(args.name, args.file)
    default: {
      const unhandled = name
      throw new Error(`Unknown tool: ${String(unhandled)}`)
    }
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function handle(message) {
  if (!message || message.jsonrpc !== '2.0') return
  if (message.id === undefined || message.id === null) return

  const { id, method, params } = message
  if (method === 'initialize') {
    const requested = params?.protocolVersion
    const protocolVersion = SUPPORTED_PROTOCOLS.includes(requested) ? requested : SUPPORTED_PROTOCOLS[0]
    send({
      jsonrpc: '2.0',
      id,
      result: { protocolVersion, capabilities: { tools: {} }, serverInfo: SERVER_INFO },
    })
    return
  }
  if (method === 'ping') {
    send({ jsonrpc: '2.0', id, result: {} })
    return
  }
  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } })
    return
  }
  if (method === 'tools/call') {
    try {
      const text = callTool(params?.name, params?.arguments ?? {})
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } })
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Tool failed'
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: true } })
    }
    return
  }
  send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${String(method)}` } })
}

let buffer = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buffer += chunk
  let newline = buffer.indexOf('\n')
  while (newline !== -1) {
    const line = buffer.slice(0, newline).replace(/\r$/, '')
    buffer = buffer.slice(newline + 1)
    if (line.trim()) {
      try {
        handle(JSON.parse(line))
      } catch {
        process.stderr.write('library-mcp: ignored a line that was not JSON\n')
      }
    }
    newline = buffer.indexOf('\n')
  }
})
