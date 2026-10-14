/**
 * HTTP helpers shared by the scenarios. Every request gets a stable `name`
 * tag (the endpoint, never the concrete URL) so the report can group by
 * endpoint, and every Django response's Server-Timing header (PERF_HEADERS=1)
 * feeds the `db_ms`, `db_queries` and `app_ms` trends under the same name.
 */
import { check } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

import { APP_ORIGIN, config } from './config.js';
import { encodeRemoteArg, REMOTE } from './remote.js';

const dbMs = new Trend('db_ms', true);
const dbQueries = new Trend('db_queries');
const appMs = new Trend('app_ms', true);
/** SvelteKit answers failed remote calls with HTTP 200 and `type: "error"`. */
const remoteErrors = new Rate('remote_errors');

/** nginx cache states whose response Django did not produce for this request. */
const CACHED = ['HIT', 'STALE', 'UPDATING', 'REVALIDATED'];

/**
 * Records the Server-Timing values of one response under its endpoint name.
 * Responses served from nginx's tile cache carry the header of the request
 * that filled the cache, so they are skipped.
 * @param {import('k6/http').RefinedResponse<any>} response
 * @param {string} name - Endpoint name tag.
 */
function recordServerTiming(response, name) {
	const header = response.headers['Server-Timing'];
	if (!header || CACHED.includes(response.headers['X-Cache-Status'])) return;
	/** @type {Record<string, number>} */
	const parts = {};
	for (const part of header.split(',')) {
		const [key, value] = part.trim().split(';dur=');
		parts[key] = Number(value);
	}
	const tags = { name };
	if (!Number.isNaN(parts.db)) dbMs.add(parts.db, tags);
	if (!Number.isNaN(parts.q)) dbQueries.add(parts.q, tags);
	if (!Number.isNaN(parts.app)) appMs.add(parts.app, tags);
}

/**
 * Checks status and records timing for one response.
 * @param {import('k6/http').RefinedResponse<any>} response
 * @param {string} name
 * @returns {import('k6/http').RefinedResponse<any>}
 */
function settle(response, name) {
	recordServerTiming(response, name);
	check(response, { [`${name} ok`]: (r) => r.status >= 200 && r.status < 400 }, { name });
	return response;
}

/**
 * Puts the user's access token into this VU's cookie jar for both hosts,
 * like the browser after login.
 * @param {string} token - JWT from tokens.json.
 */
export function signIn(token) {
	const jar = http.cookieJar();
	jar.set(config.apiUrl, 'api-access-token', token);
	jar.set(config.appUrl, 'api-access-token', token);
}

/**
 * GETs a Django API path. Bodies are discarded unless `text` is set.
 * @param {string} path - Path below the API base, e.g. `trench/?project=1`.
 * @param {string} name - Endpoint name tag.
 * @param {{ text?: boolean }} [options]
 * @returns {import('k6/http').RefinedResponse<any>}
 */
export function api(path, name, { text = false } = {}) {
	const params = {
		tags: { name },
		...(text ? { responseType: /** @type {const} */ ('text') } : {})
	};
	return settle(http.get(`${config.apiUrl}${path}`, params), name);
}

/**
 * Sends a write request to the Django API with a JSON body.
 * @param {'POST' | 'PATCH' | 'DELETE'} method
 * @param {string} path
 * @param {string} name
 * @param {object} [body]
 * @returns {import('k6/http').RefinedResponse<'text'>}
 */
export function apiWrite(method, path, name, body) {
	const response = http.request(
		method,
		`${config.apiUrl}${path}`,
		body ? JSON.stringify(body) : null,
		{
			headers: { 'Content-Type': 'application/json' },
			responseType: 'text',
			tags: { name }
		}
	);
	return /** @type {import('k6/http').RefinedResponse<'text'>} */ (settle(response, name));
}

/**
 * Fires several GETs in parallel, like the browser's tile queue.
 * @param {{ url: string, name: string, tags?: Record<string, string> }[]} requests
 */
export function batch(requests) {
	if (requests.length === 0) return;
	const responses = http.batch(
		requests.map((request) => ({
			method: 'GET',
			url: request.url,
			params: { tags: { name: request.name, ...request.tags } }
		}))
	);
	responses.forEach((response, index) => settle(response, requests[index].name));
}

/**
 * Loads a SvelteKit page with SSR, as on a full page load or hard refresh.
 * @param {string} path - App path, e.g. `/project/1/map`.
 * @param {string} name
 * @returns {import('k6/http').RefinedResponse<any>}
 */
export function page(path, name) {
	return settle(http.get(`${config.appUrl}${path}`, { tags: { name } }), name);
}

/**
 * Calls a SvelteKit remote query the way the client runtime does.
 * @param {keyof typeof REMOTE} fn - Remote function key.
 * @param {unknown} arg - Query argument (undefined for none).
 * @param {string} pagePath - Path of the page the call is made from.
 * @param {string} [search] - Query string of that page, including `?`.
 * @returns {import('k6/http').RefinedResponse<any>}
 */
export function remote(fn, arg, pagePath, search = '') {
	const name = `remote:${fn}`;
	const payload = encodeRemoteArg(arg);
	const url = `${config.appUrl}/_app/remote/${REMOTE[fn]}${payload ? `?payload=${payload}` : ''}`;
	const response = http.get(url, {
		headers: {
			Origin: APP_ORIGIN,
			'x-sveltekit-pathname': pagePath,
			'x-sveltekit-search': search
		},
		responseType: 'text',
		tags: { name }
	});
	const failed = response.status !== 200 || String(response.body).startsWith('{"type":"error"');
	remoteErrors.add(failed, { name });
	check(response, { [`${name} result`]: () => !failed }, { name });
	return response;
}
