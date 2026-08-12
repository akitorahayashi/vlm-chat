export function runBun(args: string[]) {
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
