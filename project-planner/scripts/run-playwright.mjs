import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const port = 4174;
const baseURL = `http://127.0.0.1:${port}`;
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const playwrightBin = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
const testEnv = {
  ...process.env,
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: '',
};

function waitForExit(child) {
  return new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
}

async function waitForServer(child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite wurde vorzeitig mit Code ${child.exitCode} beendet.`);
    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await delay(250);
  }
  throw new Error(`Vite war nach 60 Sekunden nicht unter ${baseURL} erreichbar.`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([waitForExit(child), delay(5_000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

const server = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(port)], {
  cwd: projectRoot,
  env: testEnv,
  stdio: 'inherit',
  shell: false,
});

let exitCode = 1;
try {
  await waitForServer(server);
  const testProcess = spawn(process.execPath, [playwrightBin, 'test'], {
    cwd: projectRoot,
    env: testEnv,
    stdio: 'inherit',
    shell: false,
  });
  const result = await waitForExit(testProcess);
  exitCode = result.code ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  await stopServer(server);
}

process.exitCode = exitCode;
