import type { RequestEvent } from '@sveltejs/kit';
import type { UserData } from '$lib/stores/auth';
import type { Permissions } from '$lib/utils/permissions';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';
import { clearAuthCookies } from '$lib/remote/auth/auth-session';
import { refreshAccessToken } from '$lib/server/tokenRefresh';

/** How long a resolved session is reused for the same access token, in ms. */
export const SESSION_CACHE_TTL_MS = 30_000;

/** Upper bound on cached sessions; the oldest entry goes when it is reached. */
export const SESSION_CACHE_MAX_ENTRIES = 1000;

interface CachedSession {
	user: UserData;
	expiresAt: number;
}

/** What Django's `auth/user/` endpoint returns for a valid token. */
interface DjangoUser {
	pk: number;
	username: string;
	email: string;
	is_staff: boolean;
	is_superuser: boolean;
}

type SessionOutcome =
	| { status: 'ok'; user: UserData }
	| { status: 'rejected' }
	| { status: 'failed' };

const UNAUTHENTICATED: UserData = { isAuthenticated: false };

const sessionCache = new Map<string, CachedSession>();

/**
 * Drops the cached session of an access token, e.g. after Django rejected it.
 * @param accessToken - The token whose entry to drop; a missing token is a no-op.
 */
export function evictSession(accessToken: string | undefined): void {
	if (accessToken) sessionCache.delete(accessToken);
}

/** Drops every cached session. Tests and a deliberate full reset use it. */
export function clearSessionCache(): void {
	sessionCache.clear();
}

/**
 * Ends the session on this server: forgets the cached user and deletes the
 * token cookies. Every path that clears the auth cookies goes through here so
 * a cache entry can never outlive its cookies.
 * @param cookies - The request's cookie jar.
 */
export function endSession(cookies: RequestEvent['cookies']): void {
	evictSession(cookies.get('api-access-token'));
	clearAuthCookies(cookies);
}

/**
 * Reads a live cache entry, dropping it when its TTL has passed.
 * @param accessToken - The token to look up.
 * @returns The cached user, or null when there is no live entry.
 */
function readCached(accessToken: string): UserData | null {
	const entry = sessionCache.get(accessToken);
	if (!entry) return null;
	if (entry.expiresAt <= Date.now()) {
		sessionCache.delete(accessToken);
		return null;
	}
	return entry.user;
}

/**
 * Stores a resolved user under its token, evicting the oldest entry at the cap.
 * @param accessToken - The token the user was resolved with.
 * @param user - The resolved user.
 */
function writeCached(accessToken: string, user: UserData): void {
	if (sessionCache.size >= SESSION_CACHE_MAX_ENTRIES) {
		const oldest = sessionCache.keys().next().value;
		if (oldest !== undefined) sessionCache.delete(oldest);
	}
	sessionCache.set(accessToken, { user, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
}

/**
 * Asks Django who the access token belongs to and what they may do. Both
 * calls run in parallel since permissions do not depend on the user payload.
 * A failed permissions call still yields an authenticated user without
 * permissions, because the route guard treats missing permissions as allow.
 * @param event - The request whose cookies carry the access token.
 * @returns The user, `rejected` when Django refused the token, or `failed` on any other error.
 */
async function fetchSession(event: RequestEvent): Promise<SessionOutcome> {
	const headers = getAuthHeaders(event.cookies);
	try {
		const [userResponse, permissionsResult] = await Promise.all([
			event.fetch(`${API_URL}auth/user/`, { headers }),
			event.fetch(`${API_URL}auth/permissions/`, { headers }).then(
				(response) => ({ ok: true as const, response }),
				(error: unknown) => ({ ok: false as const, error })
			)
		]);

		if (userResponse.status === 401 || userResponse.status === 403) {
			return { status: 'rejected' };
		}
		if (!userResponse.ok) {
			console.error('API error fetching user:', userResponse.status, await userResponse.text());
			return { status: 'failed' };
		}

		const userDetails: DjangoUser = await userResponse.json();
		let permissions: Permissions | undefined;
		if (!permissionsResult.ok) {
			console.error('Error fetching permissions:', permissionsResult.error);
		} else if (permissionsResult.response.ok) {
			permissions = await permissionsResult.response.json();
		}

		return {
			status: 'ok',
			user: {
				isAuthenticated: true,
				...userDetails,
				isAdmin: userDetails.is_staff || false,
				permissions
			}
		};
	} catch (error) {
		console.error('Network error during user fetch:', error);
		return { status: 'failed' };
	}
}

/**
 * Resolves the user behind a request: from the cache for a token seen within
 * the last 30 s, otherwise from Django (user and permissions in parallel),
 * with one token refresh when the access token was rejected. Without any
 * token Django is not asked at all. A request that ends unauthenticated has
 * its token cookies cleared and its cache entry dropped.
 * @param event - The incoming request.
 * @returns The authenticated user with permissions, or the unauthenticated marker.
 */
export async function resolveSession(event: RequestEvent): Promise<UserData> {
	const accessToken = event.cookies.get('api-access-token');
	if (accessToken) {
		const cached = readCached(accessToken);
		if (cached) return cached;
	}

	let outcome: SessionOutcome = accessToken ? await fetchSession(event) : { status: 'rejected' };
	if (outcome.status === 'rejected') {
		evictSession(accessToken);
		if ((await refreshAccessToken(event)).ok) {
			outcome = await fetchSession(event);
		}
	}

	if (outcome.status !== 'ok') {
		endSession(event.cookies);
		return UNAUTHENTICATED;
	}

	const currentToken = event.cookies.get('api-access-token');
	if (currentToken) writeCached(currentToken, outcome.user);
	return outcome.user;
}
