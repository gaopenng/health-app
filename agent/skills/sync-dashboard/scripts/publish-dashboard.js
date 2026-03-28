#!/usr/bin/env node
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const repoRootDefault = path.resolve(__dirname, '../../../..');
const defaultHealthDir = path.join(os.homedir(), '.health');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = 'true';
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function printUsage() {
  console.log(`Usage:
  node agent/skills/sync-dashboard/scripts/publish-dashboard.js \\
    [--repo-root DIR] \\
    [--health-data-dir DIR] \\
    [--dashboard-data-dir DIR] \\
    [--days 1095] \\
    [--user-id ID | --sender-id ID [--channel CHANNEL]] \\
    [--remote origin] \\
    [--branch main] \\
    [--commit-message "chore(dashboard): publish latest data"] \\
    [--no-push]

Description:
  Build dashboard JSON files, commit only the dashboard data directory, and
  push the current branch so Cloudflare Pages can deploy the latest data.
`);
}

function expandHome(input) {
  return String(input || '').replace(/^~(?=\/|$)/, os.homedir());
}

function required(value, name) {
  if (!String(value || '').trim()) {
    throw new Error(`missing required arg --${name}`);
  }
  return String(value).trim();
}

function resolveRepoRelativePath(repoRoot, targetPath) {
  const relativePath = path.relative(repoRoot, targetPath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`dashboard data dir must be inside repo root: ${targetPath}`);
  }
  return relativePath;
}

function runCommand(command, args, { cwd, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !allowFailure) {
    const stderr = String(result.stderr || '').trim();
    throw new Error(
      `${command} ${args.join(' ')} failed with code ${result.status}${stderr ? `: ${stderr}` : ''}`
    );
  }

  return result;
}

function runGit(repoRoot, args, options = {}) {
  return runCommand('git', args, { cwd: repoRoot, ...options });
}

function forwardIfPresent(target, args, flag) {
  if (args[flag] != null) {
    target.push(`--${flag}`, String(args[flag]));
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    printUsage();
    process.exit(0);
  }

  const repoRoot = path.resolve(expandHome(args['repo-root'] || repoRootDefault));
  const healthDataDir = path.resolve(expandHome(args['health-data-dir'] || defaultHealthDir));
  const dashboardDataDir = path.resolve(
    expandHome(args['dashboard-data-dir'] || path.join(repoRoot, 'dashboard', 'data'))
  );
  const remote = String(args.remote || 'origin').trim();
  const explicitBranch = String(args.branch || '').trim();
  const pushEnabled = args['no-push'] !== 'true';
  const commitMessage = String(args['commit-message'] || 'chore(dashboard): publish latest data').trim();
  const repoRelativeDashboardDir = resolveRepoRelativePath(repoRoot, dashboardDataDir);
  const buildScript = path.join(__dirname, 'build-dashboard-data.js');
  const buildArgs = [
    buildScript,
    '--health-data-dir',
    required(healthDataDir, 'health-data-dir'),
    '--output-dir',
    required(dashboardDataDir, 'dashboard-data-dir'),
  ];

  forwardIfPresent(buildArgs, args, 'days');
  forwardIfPresent(buildArgs, args, 'user-id');
  forwardIfPresent(buildArgs, args, 'sender-id');
  forwardIfPresent(buildArgs, args, 'channel');

  const buildResult = runCommand(process.execPath, buildArgs, { cwd: repoRoot });
  process.stdout.write(buildResult.stdout || '');
  process.stderr.write(buildResult.stderr || '');

  const status = runGit(repoRoot, ['status', '--porcelain', '--', repoRelativeDashboardDir]);
  if (!String(status.stdout || '').trim()) {
    console.log(`No dashboard data changes under ${repoRelativeDashboardDir}; skip commit and push.`);
    return;
  }

  runGit(repoRoot, ['add', repoRelativeDashboardDir]);

  const cachedDiff = runGit(
    repoRoot,
    ['diff', '--cached', '--quiet', '--', repoRelativeDashboardDir],
    { allowFailure: true }
  );

  if (cachedDiff.status === 1) {
    runGit(repoRoot, ['commit', '--only', '-m', commitMessage, '--', repoRelativeDashboardDir]);
  }

  const headSha = runGit(repoRoot, ['rev-parse', 'HEAD']).stdout.trim();
  console.log(`Committed dashboard data at ${headSha}`);

  if (!pushEnabled) {
    console.log('Push skipped because --no-push was provided.');
    return;
  }

  const branch = explicitBranch || runGit(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  if (!branch || branch === 'HEAD') {
    throw new Error('cannot push from detached HEAD; pass --branch explicitly');
  }

  runGit(repoRoot, ['push', remote, `${branch}:${branch}`]);
  console.log(`Pushed ${branch} to ${remote}.`);
}

try {
  main();
} catch (error) {
  console.error(`publish-dashboard failed: ${error.message}`);
  process.exit(1);
}
