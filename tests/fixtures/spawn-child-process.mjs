#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const pidFile = process.argv[2];
const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], {
  stdio: 'ignore',
  windowsHide: true
});
writeFileSync(pidFile, String(child.pid), 'utf8');
setTimeout(() => {}, 10000);
