import type { Cookies } from '@sveltejs/kit';
import type { CookieSerializeOptions } from 'cookie';
import setCookieParser from 'set-cookie-parser';

const AUTH_COOKIES = ['api-access-token', 'api-refresh-token'] as const;

/**
 * Copies the `Set-Cookie` headers of a backend auth response onto the
 * SvelteKit response so the browser receives the Django session tokens.
 * @param cookies - The request's cookie jar.
 * @param setCookieHeaders - Raw `Set-Cookie` header values from the backend.
 * @param secure - Forces the `Secure` flag, e.g. when the page was served over HTTPS.
 */
export function forwardSetCookies(cookies: Cookies, setCookieHeaders: string[], secure: boolean) {
	for (const cookie of setCookieParser.parse(setCookieHeaders)) {
		const options: CookieSerializeOptions & { path: string } = {
			path: cookie.path || '/',
			httpOnly: Boolean(cookie.httpOnly),
			secure: Boolean(cookie.secure) || secure,
			sameSite: (cookie.sameSite?.toLowerCase() as 'lax' | 'strict' | 'none') || 'lax'
		};
		if (cookie.domain) options.domain = cookie.domain;
		if (cookie.expires) options.expires = new Date(cookie.expires);
		cookies.set(cookie.name, cookie.value, options);
	}
}

/**
 * Deletes the access and refresh token cookies.
 * @param cookies - The request's cookie jar.
 */
export function clearAuthCookies(cookies: Cookies) {
	for (const name of AUTH_COOKIES) cookies.delete(name, { path: '/' });
}

/**
 * Sets the default `selected-project` cookie unless the user already has one.
 * @param cookies - The request's cookie jar.
 * @param secure - Whether the cookie must be `Secure`.
 */
export function ensureSelectedProjectCookie(cookies: Cookies, secure: boolean) {
	if (cookies.get('selected-project')) return;
	cookies.set('selected-project', '1', {
		path: '/',
		maxAge: 60 * 60 * 24 * 365,
		httpOnly: false,
		secure,
		sameSite: 'lax'
	});
}

/**
 * Builds the headers for the backend logout call: JSON content type plus the
 * CSRF token and refresh-token cookie when present.
 * @param cookies - The request's cookie jar.
 */
export function logoutHeaders(cookies: Cookies): Record<string, string> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	const csrfToken = cookies.get('csrftoken');
	const refreshToken = cookies.get('api-refresh-token');
	if (csrfToken) headers['X-CSRFToken'] = csrfToken;
	if (refreshToken) headers['Cookie'] = `api-refresh-token=${refreshToken}`;
	return headers;
}

/**
 * Reads the user-facing message from a failed Django login response.
 * @param errorData - Parsed JSON error body (may be anything).
 */
export function loginErrorMessage(errorData: unknown): string {
	const fallback = 'Login failed. Please check your credentials.';
	if (!errorData || typeof errorData !== 'object') return fallback;
	const data = errorData as { non_field_errors?: unknown; detail?: unknown };
	if (Array.isArray(data.non_field_errors) && typeof data.non_field_errors[0] === 'string') {
		return data.non_field_errors[0];
	}
	if (typeof data.detail === 'string' && data.detail) return data.detail;
	return fallback;
}

/**
 * Restricts a post-login redirect to a same-origin path so the form cannot be
 * used as an open redirect.
 * @param target - The requested redirect target.
 * @returns `target` when it is an absolute path, otherwise `/`.
 */
export function safeRedirectTarget(target: string | undefined): string {
	if (!target || !target.startsWith('/') || target.startsWith('//')) return '/';
	return target;
}
