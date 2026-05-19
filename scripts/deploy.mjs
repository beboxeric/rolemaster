// Cross-platform deploy script. Replaces bash scripts/deploy-{prod,uat}.sh.
//
//   node scripts/deploy.mjs prod       → build + deploy to rolemaster.pages.dev
//   node scripts/deploy.mjs uat        → toml-swap + deploy to rolemaster-uat.pages.dev
//   node scripts/deploy.mjs prod --force  (skip dirty-tree / branch checks)

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, renameSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const env = process.argv[2];
const FORCE = process.argv.includes('--force');

if (env !== 'prod' && env !== 'uat') {
  console.error('Usage: node scripts/deploy.mjs <prod|uat> [--force]');
  process.exit(1);
}

const project = env === 'prod' ? 'rolemaster' : 'rolemaster-uat';
const altToml = 'wrangler.uat.toml';
const backup = 'wrangler.prod.toml.bak';

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });
  return r.status ?? 1;
}

function gitClean() {
  try {
    execSync('git diff --quiet', { stdio: 'ignore' });
    execSync('git diff --cached --quiet', { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

function currentBranch() {
  try { return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim(); }
  catch { return ''; }
}

// ── Prod safety checks ────────────────────────────
if (env === 'prod') {
  if (!existsSync('wrangler.toml')) {
    console.error('ERROR: wrangler.toml missing.');
    process.exit(1);
  }
  if (!readFileSync('wrangler.toml', 'utf8').includes('name = "rolemaster"')) {
    console.error('ERROR: wrangler.toml is not the prod config (name != "rolemaster").');
    console.error('       A previous UAT deploy may have crashed mid-swap. Check wrangler.prod.toml.bak.');
    process.exit(1);
  }
  if (!gitClean() && !FORCE) {
    console.error('ERROR: working tree is dirty. Commit/stash first, or pass --force.');
    run('git', ['status', '--short']);
    process.exit(1);
  }
  const branch = currentBranch();
  if (branch !== 'main' && !FORCE) {
    console.error(`ERROR: not on main (currently '${branch}'). Switch, or pass --force.`);
    process.exit(1);
  }
}

// ── UAT toml swap ─────────────────────────────────
let swapped = false;
function restore() {
  if (swapped && existsSync(backup)) {
    try { renameSync('wrangler.toml', altToml); } catch {}
    try { renameSync(backup, 'wrangler.toml'); } catch {}
    swapped = false;
  }
}
process.on('exit', restore);
process.on('SIGINT', () => { restore(); process.exit(130); });

if (env === 'uat') {
  if (!existsSync(altToml)) {
    console.error(`ERROR: ${altToml} missing.`);
    process.exit(1);
  }
  if (existsSync(backup)) {
    console.error(`ERROR: ${backup} exists — previous deploy crashed mid-swap. Inspect manually.`);
    process.exit(1);
  }
  renameSync('wrangler.toml', backup);
  copyFileSync(altToml, 'wrangler.toml');
  swapped = true;
}

// ── Build ─────────────────────────────────────────
console.log('>>> Building SPA…');
let rc = run('npm', ['run', 'build', '--prefix', 'app']);
if (rc !== 0) {
  restore();
  process.exit(rc);
}

// ── Deploy ────────────────────────────────────────
console.log(`>>> Deploying to ${project}…`);
rc = run('npx', [
  'wrangler', 'pages', 'deploy', 'dist',
  '--project-name=' + project,
  '--branch=main',
  '--commit-dirty=true',
]);

restore();

// Move the prod-deployed git tag on success.
if (rc === 0 && env === 'prod') {
  try {
    const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    execSync(`git tag -f prod-deployed ${sha}`, { stdio: 'ignore' });
    console.log(`>>> Moved prod-deployed tag to ${sha}`);
  } catch {}
}

process.exit(rc);
