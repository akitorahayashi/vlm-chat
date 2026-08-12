import { copyFileSync, existsSync } from 'node:fs';

function runBun(args: string[]) {
  const result = Bun.spawnSync({
    cmd: [process.execPath, ...args],
    cwd: process.cwd(),
    env: process.env,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
}

runBun(['install', '--frozen-lockfile']);
runBun(['x', '--bun', 'playwright', 'install']);
runBun(['run', 'db:setup']);
runBun(['run', 'db:seed']);
