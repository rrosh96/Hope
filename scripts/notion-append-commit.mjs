#!/usr/bin/env node
/**
 * Appends the latest commit as a bullet to the Notion page "Hope — git commit timeline".
 *
 * Setup (one-time):
 * 1. In Notion: Settings → Connections → Develop or manage integrations → New integration.
 * 2. Copy the "Internal integration secret" (starts with secret_).
 * 3. Open the timeline page in Notion → ··· → Connections → Connect your integration.
 * 4. In the repo root, add to `.env` (gitignored):
 *      NOTION_TOKEN=secret_xxxxxxxx
 *    Optional override: NOTION_COMMIT_LOG_PAGE_ID=<uuid> (defaults to scripts/notion-commit-log-config.json).
 * 5. Enable hooks: `npm run hooks:install` (sets `core.hooksPath` to `.githooks`).
 *
 * Git hooks do not inherit your shell profile; `.env` in the repo root is loaded here so
 * commits from GUI clients still find the token if the file exists.
 *
 * Requires Node 18+ (global fetch). Exits 0 and does nothing if NOTION_TOKEN is unset.
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv(repoRoot) {
  const p = join(repoRoot, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

let root;
try {
  root = execSync('git rev-parse --show-toplevel', {
    encoding: 'utf8',
    cwd: __dirname,
  }).trim();
} catch {
  process.exit(0);
}

loadDotEnv(root);

const token = process.env.NOTION_TOKEN;
if (!token) {
  process.exit(0);
}

const configPath = join(__dirname, 'notion-commit-log-config.json');
const { pageId: configPageId } = JSON.parse(readFileSync(configPath, 'utf8'));
const pageId = process.env.NOTION_COMMIT_LOG_PAGE_ID || configPageId;

function git(fmt) {
  return execSync(`git log -1 --format=${fmt}`, {
    encoding: 'utf8',
    cwd: root,
  }).trim();
}

const short = git('%h');
const branch = execSync('git rev-parse --abbrev-ref HEAD', {
  encoding: 'utf8',
  cwd: root,
}).trim();
const subject = git('%s');
const date = execSync('git log -1 --format=%cd --date=format:%Y-%m-%d', {
  encoding: 'utf8',
  cwd: root,
}).trim();

const text = `${date} · ${short} · ${branch} — ${subject}`.slice(0, 1900);

const body = {
  children: [
    {
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [{ type: 'text', text: { content: text } }],
      },
    },
  ],
};

const res = await fetch(
  `https://api.notion.com/v1/blocks/${pageId}/children`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  },
);

if (!res.ok) {
  const errText = await res.text();
  console.error('[notion-append-commit]', res.status, errText);
}
