import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';
import setCookieParser from 'set-cookie-parser';

export const actions = {
	/**
	 * Authenticates the user against the backend API, sets session cookies,
	 * and redirects to the target page on success.
	 */
	login: async (event) => {
		const formData = await event.request.formData();
		const username = formData.get('username');
		const password = formData.get('password');
		const redirectTo = formData.get('redirectTo') || '/';

		try {
			const response = await event.fetch(`${API_URL}auth/login/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ username, password }),
				credentials: 'omit'
			});

			if (!response.ok) {
				const responseData = await response.json().catch(() => ({}));
				const errorMessage =
					responseData.non_field_errors?.[0] ||
					responseData.detail ||
					'Login failed. Please check your credentials.';
				return fail(response.status < 500 ? 400 : 500, { error: errorMessage });
			}

			const setCookieHeader = response.headers.get('set-cookie');

			if (setCookieHeader) {
				const cookies = setCookieParser.parse(
					response as unknown as Parameters<typeof setCookieParser.parse>[0]
				);
				cookies.forEach(
					(cookie: {
						name: string;
						value: string;
						path?: string;
						domain?: string;
						httpOnly?: boolean;
						secure?: boolean;
						sameSite?: string;
					}) => {
						const options: Record<string, unknown> = {
							path: cookie.path || '/',
							domain: cookie.domain,
							httpOnly: cookie.httpOnly,
							secure: cookie.secure || event.url.protocol === 'https:',
							sameSite: (cookie.sameSite || 'lax').toLowerCase() as 'lax' | 'strict' | 'none'
						};

						Object.keys(options).forEach(
							(key) => options[key] === undefined && delete options[key]
						);

						event.cookies.set(
							cookie.name,
							cookie.value,
							options as Parameters<typeof event.cookies.set>[2]
						);
					}
				);
			} else {
				console.warn('Login API response missing Set-Cookie header');
				return fail(500, { error: 'Authentication response missing required tokens.' });
			}
		} catch (error) {
			console.error('Error during login action fetch:', error);
			return fail(500, { error: 'An internal error occurred during login.' });
		}

		if (!event.cookies.get('selected-project')) {
			event.cookies.set('selected-project', '1', {
				path: '/',
				maxAge: 60 * 60 * 24 * 365,
				httpOnly: false,
				secure: event.url.protocol === 'https:',
				sameSite: 'lax'
			});
		}

		throw redirect(303, redirectTo as string);
	}
} satisfies Actions;
