/**
 * Run configuration from k6 environment variables (`k6 run -e NAME=value`).
 * See loadtest/README.md for what each one changes.
 */

/**
 * Reads an environment variable with a default.
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
function env(name, fallback) {
	const value = __ENV[name];
	return value === undefined || value === '' ? fallback : value;
}

/** @param {string} url @returns {string} */
const withSlash = (url) => (url.endsWith('/') ? url : `${url}/`);

export const config = {
	/** SvelteKit origin, e.g. https://app.geodock.de */
	appUrl: env('APP_URL', 'https://app.geodock.de').replace(/\/$/, ''),
	/** Django API base including the version, e.g. https://api.geodock.de/api/v1/ */
	apiUrl: withSlash(env('API_URL', 'https://api.geodock.de/api/v1/')),
	/** Path of the JSON written by `manage.py create_loadtest_users`, relative to main.js. */
	tokensFile: env('TOKENS', '../tokens.json'),
	/** check | baseline | ramp | long | stress */
	profile: env('PROFILE', 'check'),
	/** all | loadtest | comma-separated project ids */
	projects: env('PROJECTS', 'all'),
	/** on: realistic, nginx tile cache applies; bypass: unique query param per tile */
	cache: env('CACHE', 'on'),
	/** 1 enables the edit persona (writes only in loadtest-* projects) */
	writes: env('WRITES', '0') === '1',
	/** 1 requests WMS tiles through the proxy when sources are configured */
	wms: env('WMS', '1') === '1',
	/**
	 * Tile requests per tile position and layer on first load. 2 models the
	 * duplicate selection-layer sources (MapState + createXLayer); set it from
	 * the calibration recording.
	 */
	tileFactor: Number(env('TILE_FACTOR', '2')),
	/** Peak virtual users for ramp/stress. */
	maxUsers: Number(env('MAX_USERS', '60')),
	/** Viewport size of the simulated browser window. */
	viewport: { width: Number(env('VIEW_W', '1600')), height: Number(env('VIEW_H', '900')) },
	/** Multiplier on all think times; 0.5 = users act twice as fast. */
	thinkScale: Number(env('THINK', '1'))
};

/** Host the frontend sends as Origin on commands, which SvelteKit checks. */
export const APP_ORIGIN = config.appUrl;
