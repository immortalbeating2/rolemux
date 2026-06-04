#!/usr/bin/env node

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

writeFileSync(join(process.cwd(), 'worker-output.txt'), 'created by isolated worker\n', 'utf8');
console.log('WRITE_FILE_PROVIDER_OUTPUT');
