import net from 'node:net';
import { spawn } from 'node:child_process';

const host = '127.0.0.1';
const port = Number(process.env.VITE_WAIT_API_PORT ?? 4420);
const timeoutMs = 60_000;

function canConnect() {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

async function waitForApi() {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await canConnect()) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  console.warn(
    `[web] API at ${host}:${port} is not up after ${timeoutMs}ms — starting Vite anyway`,
  );
}

await waitForApi();
const child = spawn('vite', process.argv.slice(2), {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
