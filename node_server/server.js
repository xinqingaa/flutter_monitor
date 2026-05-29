#!/usr/bin/env node
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join, resolve } = require('node:path');

const rootDir = resolve(__dirname, '..');
const workbenchDir = join(rootDir, 'workbench');
const serviceDir = join(workbenchDir, 'service');
const serviceEntry = join(serviceDir, 'src', 'server.ts');

if (!existsSync(serviceEntry)) {
  console.error(`Workbench service entry not found: ${serviceEntry}`);
  process.exit(1);
}

const runner = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(
  runner,
  ['--dir', workbenchDir, '--filter', '@flutter-monitor/workbench-service', 'run', 'server'],
  {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
