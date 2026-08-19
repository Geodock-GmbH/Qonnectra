import { invalidateAll } from '$app/navigation';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { startHeartbeat, stopHeartbeat } from './tokenHeartbeat.svelte';

vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn(() => Promise.resolve())
}));

const HEARTBEAT_INTERVAL_MS = 7 * 60 * 1000;

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	stopHeartbeat();
	vi.useRealTimers();
	vi.mocked(invalidateAll).mockClear();
});

describe('startHeartbeat', () => {
	test('should trigger an immediate refresh and then refresh on each interval', () => {
		startHeartbeat();
		expect(invalidateAll).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
		expect(invalidateAll).toHaveBeenCalledTimes(2);

		vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
		expect(invalidateAll).toHaveBeenCalledTimes(3);
	});

	test('should not create duplicate intervals when called twice', () => {
		startHeartbeat();
		startHeartbeat();

		expect(invalidateAll).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
		expect(invalidateAll).toHaveBeenCalledTimes(2);
	});
});

describe('stopHeartbeat', () => {
	test('should stop further refreshes', () => {
		startHeartbeat();
		stopHeartbeat();

		vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);
		expect(invalidateAll).toHaveBeenCalledTimes(1);
	});

	test('should be safe to call when not running', () => {
		expect(() => stopHeartbeat()).not.toThrow();
	});

	test('should allow restarting after a stop', () => {
		startHeartbeat();
		stopHeartbeat();
		startHeartbeat();

		expect(invalidateAll).toHaveBeenCalledTimes(2);

		vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
		expect(invalidateAll).toHaveBeenCalledTimes(3);
	});
});
