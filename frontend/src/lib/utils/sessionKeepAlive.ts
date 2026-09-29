import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';

/** Fallback refresh cadence when Django does not report a token lifetime. */
export const DEFAULT_KEEP_ALIVE_INTERVAL_MS = 7 * 60 * 1000;

/**
 * Fraction of the reported token lifetime to wait before refreshing, so a
 * refresh always lands well before the token it replaces expires.
 */
const LIFETIME_SAFETY_FACTOR = 0.5;

/** Shortest cadence a reported lifetime may produce. */
const MIN_INTERVAL_MS = 60 * 1000;

/** How long after a refresh an out-of-band request is answered from that result. */
export const REFRESH_COOLDOWN_MS = 30 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;
let intervalMs = DEFAULT_KEEP_ALIVE_INTERVAL_MS;
let inFlight: Promise<boolean> | null = null;
let lastSuccessAt = 0;
let onVisibilityChange: (() => void) | null = null;

/**
 * Derives the refresh cadence from a reported access token lifetime, refreshing
 * halfway through it and never more often than once a minute.
 * @param expiresInMs - The token lifetime Django reported, when it reported one.
 * @returns The interval to use until the next refresh reports something else.
 */
function cadenceFor(expiresInMs: number | undefined): number {
	if (!expiresInMs || !Number.isFinite(expiresInMs)) return DEFAULT_KEEP_ALIVE_INTERVAL_MS;
	return Math.max(MIN_INTERVAL_MS, Math.round(expiresInMs * LIFETIME_SAFETY_FACTOR));
}

/**
 * Tells the user the session is over and sends them to the login page with the
 * current URL as the return target, so logging back in lands on the same
 * project, feature and tab. The map view is not carried across: the
 * per-project stored view restores it.
 */
async function handleSessionExpired(): Promise<void> {
	stopSessionKeepAlive();
	globalToaster.error({
		title: m.message_session_expired_title(),
		description: m.message_session_expired_description()
	});

	// The session is gone, so the layout data (user, projects) must be reloaded
	// for the login page to render signed out.
	const redirectTo = encodeURIComponent(page.url.pathname + page.url.search);
	await goto(resolve(`/login?redirectTo=${redirectTo}`), { invalidateAll: true });
}

/**
 * Asks the server for a new access token and reschedules the interval when the
 * reported lifetime implies a different cadence.
 * @returns True when the session was extended.
 */
async function performRefresh(): Promise<boolean> {
	let result: { ok: boolean; expiresInMs?: number };
	try {
		const { refreshSession } = await import('$lib/remote/auth/session.remote');
		result = await refreshSession();
	} catch (error) {
		// A failed request (offline, server down) is not an expired session:
		// keep the interval running so the next tick can recover.
		console.error('Session refresh failed:', error);
		return false;
	}

	if (!result.ok) {
		await handleSessionExpired();
		return false;
	}

	lastSuccessAt = Date.now();
	const cadence = cadenceFor(result.expiresInMs);
	if (cadence !== intervalMs && timer) {
		intervalMs = cadence;
		clearInterval(timer);
		timer = setInterval(() => void performRefresh(), intervalMs);
	}
	return true;
}

/**
 * Refreshes the session unless one is already in flight or a refresh succeeded
 * within the cooldown. Thirty tiles that all got a 401 therefore cost one
 * request, not thirty.
 * @param force - Ignores the cooldown; an in-flight refresh is still shared.
 * @returns True when the session is fresh, false when it could not be extended.
 */
export function ensureFreshSession(force = false): Promise<boolean> {
	if (inFlight) return inFlight;
	if (!force && Date.now() - lastSuccessAt < REFRESH_COOLDOWN_MS) return Promise.resolve(true);

	inFlight = performRefresh().finally(() => {
		inFlight = null;
	});
	return inFlight;
}

/**
 * Refreshes when the tab becomes visible again after longer than one interval.
 * Background tabs have their timers throttled, so a tab left alone for an hour
 * comes back with a token that may already be expired.
 */
function refreshOnReturn(): void {
	if (document.visibilityState !== 'visible') return;
	if (Date.now() - lastSuccessAt < intervalMs) return;
	void ensureFreshSession(true);
}

/**
 * Starts the session keep-alive. No refresh happens on start: the page request
 * that just ran went through the auth hook, so the token is already fresh.
 * Safe to call repeatedly -- a second call does not add a second interval.
 */
export function startSessionKeepAlive(): void {
	if (timer) return;

	lastSuccessAt = Date.now();
	intervalMs = DEFAULT_KEEP_ALIVE_INTERVAL_MS;
	timer = setInterval(() => void performRefresh(), intervalMs);

	onVisibilityChange = refreshOnReturn;
	document.addEventListener('visibilitychange', onVisibilityChange);
}

/** Stops the keep-alive and its visibility listener. Safe to call when stopped. */
export function stopSessionKeepAlive(): void {
	if (timer) {
		clearInterval(timer);
		timer = null;
	}
	if (onVisibilityChange) {
		document.removeEventListener('visibilitychange', onVisibilityChange);
		onVisibilityChange = null;
	}
	inFlight = null;
	lastSuccessAt = 0;
}

/**
 * Runs the keep-alive exactly while someone is signed in. Login and logout are
 * client-side navigations that leave the root layout mounted, so the layout
 * calls this after every navigation rather than only on mount.
 * @param authenticated - Whether the session of the current page is signed in.
 */
export function syncSessionKeepAlive(authenticated: boolean): void {
	if (authenticated) startSessionKeepAlive();
	else stopSessionKeepAlive();
}

/** Whether the keep-alive interval is currently running. */
export function isSessionKeepAliveRunning(): boolean {
	return timer !== null;
}
