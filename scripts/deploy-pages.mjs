import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (args, options = {}) => execFileSync('git', args, {
  cwd: root,
  encoding: 'utf8',
  ...options,
}).trim();

// Publish only a committed source revision, so the deployed version is traceable.
if (git(['status', '--porcelain'])) {
  throw new Error('Commit or stash pending changes before deploying.');
}
const sourceCommit = git(['rev-parse', 'HEAD']);
execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
});
writeFileSync(join(root, 'dist', 'deployment.json'), JSON.stringify({
  sourceCommit,
  builtAt: new Date().toISOString(),
}, null, 2) + '\n');

const branch = 'refs/heads/gh-pages';
const advertised = git(['ls-remote', '--heads', 'origin', branch]);
let parent = '';
if (advertised) {
  git(['fetch', '--no-tags', 'origin', branch]);
  parent = git(['rev-parse', 'FETCH_HEAD']);
}

// A temporary index builds a separate deployment tree without switching or
// modifying the source checkout. Normal pushes reject concurrent remote edits.
const temporary = mkdtempSync(join(tmpdir(), 'veylun-pages-'));
try {
  const env = { ...process.env, GIT_INDEX_FILE: join(temporary, 'index') };
  git(['read-tree', '--empty'], { env });
  git(['--work-tree=' + join(root, 'dist'), 'add', '--all', '--', '.'], { env });
  const tree = git(['write-tree'], { env });
  const args = ['commit-tree', tree];
  if (parent) args.push('-p', parent);
  args.push('-m', `deploy: Veylun ${sourceCommit.slice(0, 12)}`);
  const deployment = git(args, { env });
  git(['push', 'origin', `${deployment}:${branch}`], { stdio: ['ignore', 'pipe', 'inherit'] });
  console.log(`Build uploaded to gh-pages: ${deployment}`);
  console.log('Site URL, once Pages is enabled: https://dabot11.github.io/Veylun/');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
