import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const vite = resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
const local = process.argv.includes('--local');
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
}
for (const [label, cwd, args] of [
  ['API', resolve(root, 'backend'), ['--watch', local ? 'src/local.js' : 'src/server.js']],
  ['Web', resolve(root, 'frontend'), [vite, '--host', '127.0.0.1']],
]) {
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', shell: false });
  children.push(child);
  child.on('error', error => { console.error(`${label} could not start: ${error.code || error.name}`); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code || 0); });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
