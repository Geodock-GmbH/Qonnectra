import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
	getCurrentWMSToken,
	isWMSHeartbeatRunning,
	requestImmediateWMSRefresh,
	startWMSHeartbeat,
	stopWMSHeartbeat
} from './wmsTokenHeartbeat.svelte';
import { fetchWMSAccessToken } from './wmsApi';

vi.mock('./wmsApi', () => ({
	fetchWMSAccessToken: vi.fn()
}));

const WMS_TOKEN_INTERVAL_MS = 3 * 60 * 1000;

function makeAuthError(status: number): Error {
	const error = new Error(`auth ${status}`);
	(error as { status?: number }).status = status;
	return error;
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	stopWMSHeartbeat();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.mocked(fetchWMSAccessToken).mockReset();
});

describe('startWMSHeartbeat', () => {
	test('should refresh the token on each interval and notify the callback', async () => {
		vi.mocked(fetchWMSAccessToken).mockResolvedValue('tok-1');
		const onRefresh = vi.fn();

		startWMSHeartbeat(onRefresh);
		expect(isWMSHeartbeatRunning()).toBe(true);
		expect(getCurrentWMSToken()).toBeNull();

		await vi.advanceTimersByTimeAsync(WMS_TOKEN_INTERVAL_MS);

		expect(fetchWMSAccessToken).toHaveBeenCalledTimes(1);
		expect(onRefresh).toHaveBeenCalledWith('tok-1');
		expect(getCurrentWMSToken()).toBe('tok-1');
	});

	test('should store the initial token without fetching', () => {
		startWMSHeartbeat(vi.fn(), 'initial-tok');

		expect(getCurrentWMSToken()).toBe('initial-tok');
		expect(fetchWMSAccessToken).not.toHaveBeenCalled();
	});

	test('should adopt a fresh initial token when already running without duplicating intervals', async () => {
		vi.mocked(fetchWMSAccessToken).mockResolvedValue('tok-refresh');

		startWMSHeartbeat(vi.fn(), 'first-tok');
		startWMSHeartbeat(vi.fn(), 'second-tok');

		expect(getCurrentWMSToken()).toBe('second-tok');

		await vi.advanceTimersByTimeAsync(WMS_TOKEN_INTERVAL_MS);
		expect(fetchWMSAccessToken).toHaveBeenCalledTimes(1);
	});

	test('should stop and call the auth failure callback on a 401', async () => {
		vi.mocked(fetchWMSAccessToken).mockRejectedValue(makeAuthError(401));
		const onAuthFailure = vi.fn();

		startWMSHeartbeat(vi.fn(), undefined, onAuthFailure);
		await vi.advanceTimersByTimeAsync(WMS_TOKEN_INTERVAL_MS);

		expect(isWMSHeartbeatRunning()).toBe(false);
		expect(onAuthFailure).toHaveBeenCalledTimes(1);
	});

	test('should stop after three consecutive non-auth failures', async () => {
		vi.mocked(fetchWMSAccessToken).mockRejectedValue(new Error('network down'));
		const onAuthFailure = vi.fn();

		startWMSHeartbeat(vi.fn(), undefined, onAuthFailure);

		await vi.advanceTimersByTimeAsync(WMS_TOKEN_INTERVAL_MS * 2);
		expect(isWMSHeartbeatRunning()).toBe(true);
		expect(onAuthFailure).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(WMS_TOKEN_INTERVAL_MS);
		expect(isWMSHeartbeatRunning()).toBe(false);
		expect(onAuthFailure).toHaveBeenCalledTimes(1);
	});

	test('should reset the failure counter after a successful refresh', async () => {
		vi.mocked(fetchWMSAccessToken)
			.mockRejectedValueOnce(new Error('down'))
			.mockRejectedValueOnce(new Error('down'))
			.mockResolvedValueOnce('tok-ok')
			.mockRejectedValue(new Error('down'));

		startWMSHeartbeat(vi.fn());

		await vi.advanceTimersByTimeAsync(WMS_TOKEN_INTERVAL_MS * 5);
		expect(isWMSHeartbeatRunning()).toBe(true);
	});
});

describe('stopWMSHeartbeat', () => {
	test('should clear the token and stop refreshing', async () => {
		vi.mocked(fetchWMSAccessToken).mockResolvedValue('tok-1');

		startWMSHeartbeat(vi.fn(), 'initial-tok');
		stopWMSHeartbeat();

		expect(isWMSHeartbeatRunning()).toBe(false);
		expect(getCurrentWMSToken()).toBeNull();

		await vi.advanceTimersByTimeAsync(WMS_TOKEN_INTERVAL_MS * 2);
		expect(fetchWMSAccessToken).not.toHaveBeenCalled();
	});
});

describe('requestImmediateWMSRefresh', () => {
	test('should do nothing when the heartbeat is not running', () => {
		requestImmediateWMSRefresh();
		expect(fetchWMSAccessToken).not.toHaveBeenCalled();
	});

	test('should refresh immediately when running', async () => {
		vi.mocked(fetchWMSAccessToken).mockResolvedValue('tok-now');
		const onRefresh = vi.fn();

		startWMSHeartbeat(onRefresh);
		requestImmediateWMSRefresh(true);
		await vi.advanceTimersByTimeAsync(0);

		expect(fetchWMSAccessToken).toHaveBeenCalledTimes(1);
		expect(onRefresh).toHaveBeenCalledWith('tok-now');
	});

	test('should enforce a cooldown between immediate refreshes', async () => {
		vi.mocked(fetchWMSAccessToken).mockResolvedValue('tok-now');

		startWMSHeartbeat(vi.fn());
		requestImmediateWMSRefresh(true);
		await vi.advanceTimersByTimeAsync(0);

		requestImmediateWMSRefresh();
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchWMSAccessToken).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(30 * 1000);
		requestImmediateWMSRefresh();
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchWMSAccessToken).toHaveBeenCalledTimes(2);
	});

	test('should bypass the cooldown when forced', async () => {
		vi.mocked(fetchWMSAccessToken).mockResolvedValue('tok-now');

		startWMSHeartbeat(vi.fn());
		requestImmediateWMSRefresh(true);
		await vi.advanceTimersByTimeAsync(0);

		requestImmediateWMSRefresh(true);
		await vi.advanceTimersByTimeAsync(0);

		expect(fetchWMSAccessToken).toHaveBeenCalledTimes(2);
	});
});
