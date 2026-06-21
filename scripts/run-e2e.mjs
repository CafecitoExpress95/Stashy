import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const viteCli = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const playwrightCli = fileURLToPath(
	new URL('../node_modules/@playwright/test/cli.js', import.meta.url)
);

function waitForExit(child) {
	return new Promise((resolve, reject) => {
		child.once('error', reject);
		child.once('exit', (code, signal) => resolve({ code, signal }));
	});
}

function findAvailablePort() {
	return new Promise((resolve, reject) => {
		const probe = createServer();
		probe.unref();
		probe.once('error', reject);
		probe.listen(0, '127.0.0.1', () => {
			const address = probe.address();
			if (!address || typeof address === 'string') {
				probe.close();
				reject(new Error('Could not reserve a preview port.'));
				return;
			}
			const port = address.port;
			probe.close((error) => (error ? reject(error) : resolve(port)));
		});
	});
}

async function waitForServer(baseUrl, serverExit) {
	for (let attempt = 0; attempt < 80; attempt += 1) {
		const earlyExit = await Promise.race([
			serverExit.then((result) => ({ kind: 'exit', result })),
			new Promise((resolve) => setTimeout(() => resolve({ kind: 'wait' }), 100))
		]);
		if (earlyExit.kind === 'exit') {
			throw new Error(`Preview server exited before it was ready (${earlyExit.result.code}).`);
		}
		try {
			const response = await fetch(baseUrl);
			if (response.ok) return;
		} catch {
			// The preview server is still starting.
		}
	}
	throw new Error('Timed out waiting for the Stashy preview server.');
}

const port = await findAvailablePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(
	process.execPath,
	[viteCli, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
	{
		stdio: 'inherit',
		windowsHide: true
	}
);
const serverExit = waitForExit(server);
let testExitCode;

try {
	await waitForServer(baseUrl, serverExit);
	const tests = spawn(process.execPath, [playwrightCli, 'test'], {
		stdio: 'inherit',
		windowsHide: true,
		env: { ...process.env, PLAYWRIGHT_BASE_URL: baseUrl }
	});
	const result = await waitForExit(tests);
	testExitCode = result.code ?? 1;
} finally {
	if (server.exitCode === null) {
		server.kill();
		await Promise.race([serverExit, new Promise((resolve) => setTimeout(resolve, 5_000))]);
		if (server.exitCode === null) server.kill('SIGKILL');
	}
}

process.exitCode = testExitCode;
