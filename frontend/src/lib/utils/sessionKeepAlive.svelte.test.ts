import { goto } from '$app/navigation';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { refreshSession } from '$lib/remote/auth/session.remote';

import {
	DEFAULT_KEEP_ALIVE_INTERVAL_MS,
	ensureFreshSession,
	isSessionKeepAliveRunning,
	REFRESH_COOLDOWN_MS,
	startSessionKeepAlive,
	stopSessionKeepAlive,
	syncSessionKeepAlive
} from './sessionKeepAlive';

vi.mock('$app/navigation', () => ({
	goto: vi.fn(() => Promise.resolve())
}));

const appState = vi.hoisted(() => ({
	page: { url: new URL('http://localhost/project/5/map?feature=trench%3Aabc') }
}));

vi.mock('$app/state', () => ({
	page: appState.page
}));

vi.mock('$app/paths', () => ({
	resolve: (path: string) => path
}));

vi.mock('$lib/remote/auth/session.remote', () => ({
	refreshSession: vi.fn(() => Promise.resolve({ ok: true }))
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: { error: vi.fn() }
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => prop })
}));

/** Flushes the microtask queue so an awaited refresh settles under fake timers. */
async function flush(): Promise<void> {
	await vi.advanceTimersByTimeAsync(0);
}

/** Fires a `visibilitychange` with the document reporting the given state. */
function setVisibility(state: 'visible' | 'hidden'): void {
	Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
	document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
	vi.useFakeTimers();
	appState.page.url = new URL('http://localhost/project/5/map?feature=trench%3Aabc');
	vi.mocked(refreshSession).mockResolvedValue({ ok: true });
});

afterEach(() => {
	stopSessionKeepAlive();
	vi.useRealTimers();
	vi.clearAllMocks();
});

describe('startSessionKeepAlive', () => {
	test('should not refresh on start, because the page request just authenticated', () => {
		startSessionKeepAlive();

		expect(refreshSession).not.toHaveBeenCalled();
		expect(isSessionKeepAliveRunning()).toBe(true);
	});

	test('should refresh the session once per interval', async () => {
		startSessionKeepAlive();

		await vi.advanceTimersByTimeAsync(DEFAULT_KEEP_ALIVE_INTERVAL_MS);
		expect(refreshSession).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(DEFAULT_KEEP_ALIVE_INTERVAL_MS);
		expect(refreshSession).toHaveBeenCalledTimes(2);
	});

	test('should not create a second interval when called twice', async () => {
		startSessionKeepAlive();
		startSessionKeepAlive();

		await vi.advanceTimersByTimeAsync(DEFAULT_KEEP_ALIVE_INTERVAL_MS);
		expect(refreshSession).toHaveBeenCalledTimes(1);
	});

	test('should follow the token lifetime the server reports', async () => {
		vi.mocked(refreshSession).mockResolvedValue({ ok: true, expiresInMs: 4 * 60 * 1000 });
		startSessionKeepAlive();

		await vi.advanceTimersByTimeAsync(DEFAULT_KEEP_ALIVE_INTERVAL_MS);
		expect(refreshSession).toHaveBeenCalledTimes(1);

		// Half of the reported 4 min lifetime, well short of the 7 min default.
		await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
		expect(refreshSession).toHaveBeenCalledTimes(2);
	});
});

describe('stopSessionKeepAlive', () => {
	test('should stop further refreshes', async () => {
		startSessionKeepAlive();
		stopSessionKeepAlive();

		await vi.advanceTimersByTimeAsync(DEFAULT_KEEP_ALIVE_INTERVAL_MS * 3);
		expect(refreshSession).not.toHaveBeenCalled();
		expect(isSessionKeepAliveRunning()).toBe(false);
	});

	test('should be safe to call when not running', () => {
		expect(() => stopSessionKeepAlive()).not.toThrow();
	});
});

describe('syncSessionKeepAlive', () => {
	test('should start for a signed-in user, e.g. after a login in the open tab', async () => {
		syncSessionKeepAlive(true);

		expect(refreshSession).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(DEFAULT_KEEP_ALIVE_INTERVAL_MS);
		expect(refreshSession).toHaveBeenCalledTimes(1);
	});

	test('should stop after a logout, so no expiry is reported on the login page', async () => {
		syncSessionKeepAlive(true);
		syncSessionKeepAlive(false);

		await vi.advanceTimersByTimeAsync(DEFAULT_KEEP_ALIVE_INTERVAL_MS * 2);
		expect(refreshSession).not.toHaveBeenCalled();
		expect(globalToaster.error).not.toHaveBeenCalled();
	});
});

describe('ensureFreshSession', () => {
	test('should collapse concurrent calls into one request', async () => {
		let settle: (value: { ok: boolean }) => void = () => {};
		vi.mocked(refreshSession).mockReturnValue(
			new Promise<{ ok: boolean }>((r) => (settle = r)) as ReturnType<typeof refreshSession>
		);

		const calls = Array.from({ length: 10 }, () => ensureFreshSession());
		settle({ ok: true });

		expect(await Promise.all(calls)).toEqual(Array(10).fill(true));
		expect(refreshSession).toHaveBeenCalledTimes(1);
	});

	test('should answer from the cooldown after a recent success', async () => {
		expect(await ensureFreshSession()).toBe(true);
		expect(refreshSession).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(REFRESH_COOLDOWN_MS - 1000);
		expect(await ensureFreshSession()).toBe(true);
		expect(refreshSession).toHaveBeenCalledTimes(1);
	});

	test('should refresh again once the cooldown has passed', async () => {
		await ensureFreshSession();
		vi.advanceTimersByTime(REFRESH_COOLDOWN_MS + 1000);

		await ensureFreshSession();
		expect(refreshSession).toHaveBeenCalledTimes(2);
	});

	test('should ignore the cooldown when forced', async () => {
		await ensureFreshSession();
		await ensureFreshSession(true);

		expect(refreshSession).toHaveBeenCalledTimes(2);
	});

	test('should keep the session alive when the request itself fails', async () => {
		vi.mocked(refreshSession).mockRejectedValue(new Error('offline'));
		vi.spyOn(console, 'error').mockImplementation(() => {});
		startSessionKeepAlive();

		expect(await ensureFreshSession(true)).toBe(false);
		expect(goto).not.toHaveBeenCalled();
		expect(isSessionKeepAliveRunning()).toBe(true);
	});
});

describe('an expired session', () => {
	test('should toast and send the user to login with the current URL as the target', async () => {
		vi.mocked(refreshSession).mockResolvedValue({ ok: false });
		startSessionKeepAlive();

		await vi.advanceTimersByTimeAsync(DEFAULT_KEEP_ALIVE_INTERVAL_MS);

		expect(globalToaster.error).toHaveBeenCalledTimes(1);
		// The feature uuid keeps its own encoding, so `trench:abc` stays `trench%3Aabc`.
		// The layout data is reloaded, so the login page shows the signed-out app.
		expect(goto).toHaveBeenCalledWith(
			`/login?redirectTo=${encodeURIComponent('/project/5/map?feature=trench%3Aabc')}`,
			{ invalidateAll: true }
		);
		expect(isSessionKeepAliveRunning()).toBe(false);
	});

	test('should preserve the query string of the current place', async () => {
		vi.mocked(refreshSession).mockResolvedValue({ ok: false });
		appState.page.url = new URL('http://localhost/project/7/conduit?search=DN50&page=2');

		await ensureFreshSession();

		expect(goto).toHaveBeenCalledWith(
			`/login?redirectTo=${encodeURIComponent('/project/7/conduit?search=DN50&page=2')}`,
			{ invalidateAll: true }
		);
	});
});

describe('returning to a background tab', () => {
	test('should refresh when the tab was hidden longer than one interval', async () => {
		startSessionKeepAlive();
		vi.mocked(refreshSession).mockClear();

		// Timers are throttled while hidden, so no interval tick fires.
		vi.setSystemTime(Date.now() + DEFAULT_KEEP_ALIVE_INTERVAL_MS + 1000);
		setVisibility('visible');
		await flush();

		expect(refreshSession).toHaveBeenCalledTimes(1);
	});

	test('should not refresh for a short switch away', async () => {
		startSessionKeepAlive();

		vi.setSystemTime(Date.now() + 5000);
		setVisibility('visible');
		await flush();

		expect(refreshSession).not.toHaveBeenCalled();
	});

	test('should ignore the event when the tab became hidden', async () => {
		startSessionKeepAlive();

		vi.setSystemTime(Date.now() + DEFAULT_KEEP_ALIVE_INTERVAL_MS + 1000);
		setVisibility('hidden');
		await flush();

		expect(refreshSession).not.toHaveBeenCalled();
	});
});
