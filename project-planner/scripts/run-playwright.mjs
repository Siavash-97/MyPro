import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

/**
 * Einen freien Port vom Betriebssystem geben lassen, statt einen zu raten.
 *
 * Warum: Am 26.08.2026 stand die Pruefsuite nach einem Windows-Neustart mit
 * `EACCES: permission denied 127.0.0.1:4174`. Der Port war nicht belegt -
 * Windows hatte den Bereich 4143-4242 fuer sich reserviert
 * (`netsh interface ipv4 show excludedportrange protocol=tcp`). Solche
 * Reservierungen sind dynamisch und verschieben sich bei jedem Neustart.
 *
 * Ein fest verdrahteter Port ist damit eine Tretmine unter der Suite, die
 * irgendwann zuschlaegt und wie ein Testfehler aussieht.
 *
 * Der Restrisiko-Satz, damit ihn niemand suchen muss: Zwischen dem
 * Schliessen der Probe und dem Binden durch Vite liegt ein winziges
 * Zeitfenster, in dem ein anderer Prozess den Port nehmen koennte. Dann
 * scheitert der Start sichtbar - kein stiller Fehler.
 */
async function freierPort() {
  const { createServer } = await import('node:net');
  return new Promise((erfuellen, ablehnen) => {
    const probe = createServer();
    probe.on('error', ablehnen);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => erfuellen(port));
    });
  });
}

const port = Number(process.env.PLANER_E2E_PORT) || (await freierPort());
const baseURL = `http://127.0.0.1:${port}`;
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const playwrightBin = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
const testEnv = {
  ...process.env,
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: '',
  // Damit playwright.config.ts denselben Port benutzt wie der Server hier.
  // Ohne das starten beide auf verschiedenen Haefen und jeder Test scheitert
  // mit "connection refused" - ein Fehlerbild, das nach Testfehler aussieht.
  PLANER_E2E_PORT: String(port),
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
