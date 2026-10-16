import { createServer } from 'node:net';
import type { Server, Socket } from 'node:net';
import { Headers, Request, Response, fetch as undiciFetch } from 'undici';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';

import { init } from './hooks.server';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

/**
 * Body sizes just above undici's 64 KiB body buffer: the parser pauses on the
 * last read, so the server's FIN arrives while it is still paused.
 */
const BODY_SIZES = [65_536, 70_000, 100_000];

let server: Server;
let port: number;
let lastSocketClosed: Promise<void>;

beforeAll(async () => {
	// Answers like gunicorn's sync workers: the whole body, then the connection closes.
	server = createServer((socket: Socket) => {
		lastSocketClosed = new Promise((resolve) => socket.once('close', () => resolve()));
		socket.once('data', (request) => {
			const size = Number(request.toString().split(' ')[1].slice(1));
			socket.write(
				`HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${size}\r\nConnection: close\r\n\r\n`
			);
			socket.end(Buffer.alloc(size, ' '));
		});
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	port = (server.address() as { port: number }).port;
});

afterAll(() => {
	server.close();
});

test('should replace the fetch globals with the undici package', async () => {
	await init();

	expect(globalThis.fetch).toBe(undiciFetch);
	expect(globalThis.Request).toBe(Request);
	expect(globalThis.Response).toBe(Response);
	expect(globalThis.Headers).toBe(Headers);
});

/**
 * Only Node's bundled undici 6.28+ / 7.x crash here (Node ≥ 22.22); older
 * bundles stay green without the fix. The crash is thrown from a socket
 * handler, so it is collected and asserted instead of surfacing as an
 * unhandled error next to a passing test.
 */
test('should survive Django closing a connection while a response body is unread', async () => {
	await init();
	const crashes: unknown[] = [];
	const collect = (crash: unknown) => crashes.push(crash);
	process.on('uncaughtException', collect);

	try {
		for (const size of BODY_SIZES) {
			const response = await fetch(`http://127.0.0.1:${port}/${size}`);
			expect(response.ok).toBe(true);
			await lastSocketClosed;
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	} finally {
		process.off('uncaughtException', collect);
	}

	expect(crashes).toEqual([]);
});
