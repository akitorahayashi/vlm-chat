import { copyFileSync, existsSync } from 'node:fs';
import { runBun } from './run-bun.ts';

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
}

runBun(['install', '--frozen-lockfile']);
runBun(['x', '--bun', 'playwright', 'install']);
runBun(['run', 'db:setup']);
