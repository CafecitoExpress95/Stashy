import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const baseUrl = 'http://127.0.0.1:4173';
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

async function waitForServer(serverExit) {
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

const server = spawn(
	process.execPath,
	[viteCli, 'preview', '--host', '127.0.0.1', '--port', '4173'],
	{
		stdio: 'inherit',
		windowsHide: true
	}
);
const serverExit = waitForExit(server);
let testExitCode;

try {
	await waitForServer(serverExit);
	const tests = spawn(process.execPath, [playwrightCli, 'test'], {
		stdio: 'inherit',
		windowsHide: true
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
