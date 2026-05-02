#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';

const ROOT_GUARDRAIL_FILES = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'package.json',
  'package-lock.json',
  'knip.jsonc',
  'tsconfig.json',
  'vite.config.ts',
  'svelte.config.js',
  'playwright.config.ts'
]);

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsonc',
  '.md',
  '.mjs',
  '.rs',
  '.sql',
  '.svelte',
  '.toml',
  '.ts',
  '.txt',
  '.yml'
]);

const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.svelte', '.ts']);
const KNIP_TRIGGER_FILES = new Set(['package.json', 'package-lock.json', 'knip.jsonc', 'scripts/code-health.mjs']);

const AI_SLOP_PATTERNS = [
  {
    pattern: /\bas an ai language model\b/i,
    message: 'Remove assistant meta-commentary before committing.'
  },
  {
    pattern: /\blorem ipsum\b/i,
    message: 'Replace filler text with project-specific copy or delete it.'
  },
  {
    pattern: /\byour code here\b/i,
    message: 'Replace placeholder code before committing.'
  },
  {
    pattern: new RegExp(['placeholder', 'implementation'].join('\\s+'), 'i'),
    message: 'Replace unfinished stub code before committing.'
  },
  {
    pattern: /TODO:\s*(implement|fill in|stub|wire up)/i,
    message: 'Replace vague TODOs with working code or a specific tracked follow-up.'
  },
  {
    pattern: /throw new Error\((['"`])Not implemented\1\)/i,
    message: 'Replace non-functional stubs before committing.'
  }
];

const TEST_FOCUS_PATTERN = /\b(?:test|it|describe)\.only\s*\(/;
const CONFLICT_MARKER_PATTERN = /^(<<<<<<<|=======|>>>>>>>) /m;

function usage() {
  console.log('Usage: node scripts/code-health.mjs [--changed|--full]');
}

function parseMode(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    usage();
    process.exit(0);
  }

  const modes = argv.filter((arg) => arg === '--changed' || arg === '--full');
  if (modes.length > 1) {
    console.error('Choose only one mode: --changed or --full.');
    process.exit(2);
  }

  return modes[0] === '--full' ? 'full' : 'changed';
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe'
  });

  if (result.error) {
    return { ok: false, status: 1, stdout: '', stderr: result.error.message };
  }

  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  };
}

function splitNul(value) {
  return value.split('\0').filter(Boolean);
}

function uniqueSorted(files) {
  return Array.from(new Set(files)).sort((a, b) => a.localeCompare(b));
}

function gitFiles(args) {
  const result = run('git', args);
  if (!result.ok) {
    console.error(result.stderr.trim() || result.stdout.trim());
    process.exit(result.status);
  }
  return splitNul(result.stdout);
}

function changedFiles() {
  return uniqueSorted([
    ...gitFiles(['diff', '--name-only', '--diff-filter=ACMRTUXB', '-z', 'HEAD']),
    ...gitFiles(['ls-files', '--others', '--exclude-standard', '-z'])
  ]);
}

function allFiles() {
  return uniqueSorted([
    ...gitFiles(['ls-files', '-z']),
    ...gitFiles(['ls-files', '--others', '--exclude-standard', '-z'])
  ]);
}

function isTextFile(file) {
  if (!existsSync(file)) return false;
  if (file.includes('/node_modules/') || file.startsWith('node_modules/')) return false;
  if (file.includes('/build/') || file.startsWith('build/')) return false;
  if (file.includes('/.svelte-kit/') || file.startsWith('.svelte-kit/')) return false;
  if (ROOT_GUARDRAIL_FILES.has(file)) return true;
  return TEXT_EXTENSIONS.has(extname(file));
}

function isSourceFile(file) {
  return SOURCE_EXTENSIONS.has(extname(file));
}

function checkFiles(files) {
  const failures = [];
  const textFiles = files.filter(isTextFile);

  for (const file of textFiles) {
    const content = readFileSync(file, 'utf8');

    if (CONFLICT_MARKER_PATTERN.test(content)) {
      failures.push(`${file}: remove merge conflict markers.`);
    }

    if (isSourceFile(file) && TEST_FOCUS_PATTERN.test(content)) {
      failures.push(`${file}: remove focused test marker (.only).`);
    }

    if (isSourceFile(file)) {
      for (const { pattern, message } of AI_SLOP_PATTERNS) {
        if (pattern.test(content)) {
          failures.push(`${file}: ${message}`);
        }
      }
    }
  }

  return failures;
}

function shouldRunKnip(mode, files) {
  if (mode === 'full') return true;
  return files.some((file) => KNIP_TRIGGER_FILES.has(file) || file.startsWith('.github/workflows/'));
}

function syncSvelteKit() {
  if (!existsSync('svelte.config.js')) return true;

  console.log('Syncing SvelteKit metadata...');
  const result = run('svelte-kit', ['sync'], { stdio: 'inherit' });
  if (!result.ok) {
    if (result.stderr) console.error(result.stderr.trim());
    return false;
  }

  return true;
}

function runKnip() {
  if (!syncSvelteKit()) return false;

  console.log('Running Knip...');
  const result = run('knip', ['--config', 'knip.jsonc'], { stdio: 'inherit' });
  if (!result.ok) {
    if (result.stderr) console.error(result.stderr.trim());
    return false;
  }
  return true;
}

function printFileSummary(mode, files) {
  if (files.length === 0) {
    console.log(`Code health (${mode}): no files to inspect.`);
    return;
  }

  console.log(`Code health (${mode}): inspecting ${files.length} file${files.length === 1 ? '' : 's'}.`);
  if (mode === 'changed' && files.length <= 12) {
    for (const file of files) console.log(`- ${file}`);
  } else if (mode === 'changed') {
    for (const file of files.slice(0, 12)) console.log(`- ${file}`);
    console.log(`- ...and ${files.length - 12} more`);
  }
}

const mode = parseMode(process.argv.slice(2));
const files = mode === 'full' ? allFiles() : changedFiles();

printFileSummary(mode, files);

const failures = checkFiles(files);
if (failures.length > 0) {
  console.error('\nCode-health guardrails failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (shouldRunKnip(mode, files) && !runKnip()) {
  process.exit(1);
}

console.log(`Code health (${mode}) passed.`);
