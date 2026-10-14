/**
 * Qonnectra load test entry point. Personas run as separate k6 scenarios,
 * weighted like a working team (mostly map users), and the PROFILE decides
 * how many users there are over time. See loadtest/README.md.
 *
 *   k6 run -e PROFILE=check -e TOKENS=../tokens.json main.js
 */
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

import { signIn } from './lib/client.js';
import { config } from './lib/config.js';
import { discover } from './lib/fixtures.js';
import { editSession } from './scenarios/edit.js';
import { mapSession } from './scenarios/map.js';
import { schemaSession } from './scenarios/schema.js';
import { searchSession } from './scenarios/search.js';

const tokens = new SharedArray('tokens', () => JSON.parse(open(config.tokensFile)).users);

/** Share of concurrent users per persona. */
const PERSONAS = config.writes
	? { map: 0.6, search: 0.15, schema: 0.15, edit: 0.1 }
	: { map: 0.65, search: 0.17, schema: 0.18 };

const EXEC = { map: 'map', search: 'search', schema: 'schema', edit: 'edit' };

/**
 * Splits a total user count across personas, at least one each.
 * @param {number} total
 * @param {number} share
 * @returns {number}
 */
function usersFor(total, share) {
	return total === 0 ? 0 : Math.max(1, Math.round(total * share));
}

/**
 * Stages that climb by 5 users every 2 minutes up to `max`: 30 s ramp, 90 s hold.
 * @param {number} max
 * @param {number} share
 * @returns {{ duration: string, target: number }[]}
 */
function stairs(max, share) {
	const stages = [];
	for (let users = 5; users <= max; users += 5) {
		stages.push({ duration: '30s', target: usersFor(users, share) });
		stages.push({ duration: '90s', target: usersFor(users, share) });
	}
	stages.push({ duration: '30s', target: 0 });
	return stages;
}

/**
 * Builds the k6 scenarios for the chosen profile.
 * @returns {Record<string, object>}
 */
function scenarios() {
	/** @type {Record<string, object>} */
	const result = {};
	for (const [persona, share] of Object.entries(PERSONAS)) {
		const base = { exec: EXEC[/** @type {keyof typeof EXEC} */ (persona)], gracefulStop: '30s' };
		switch (config.profile) {
			case 'check':
				result[persona] = {
					...base,
					executor: 'per-vu-iterations',
					vus: 1,
					iterations: 1,
					maxDuration: '5m'
				};
				break;
			case 'baseline':
				result[persona] = {
					...base,
					executor: 'constant-vus',
					vus: usersFor(10, share),
					duration: '10m'
				};
				break;
			case 'long':
				result[persona] = {
					...base,
					executor: 'constant-vus',
					vus: usersFor(Math.round(config.maxUsers / 2), share),
					duration: '30m'
				};
				break;
			case 'stress':
				result[persona] = {
					...base,
					executor: 'ramping-vus',
					startVUs: 0,
					stages: [
						{ duration: '2m', target: usersFor(config.maxUsers, share) },
						{ duration: '5m', target: usersFor(config.maxUsers, share) },
						{ duration: '30s', target: 0 }
					]
				};
				break;
			case 'ramp':
				result[persona] = {
					...base,
					executor: 'ramping-vus',
					startVUs: 0,
					stages: stairs(config.maxUsers, share)
				};
				break;
			default:
				throw new Error(`Unknown PROFILE=${config.profile}`);
		}
	}
	return result;
}

export const options = {
	scenarios: scenarios(),
	discardResponseBodies: true,
	batch: 16,
	batchPerHost: 16,
	systemTags: ['status', 'method', 'name', 'scenario', 'expected_response', 'error_code'],
	summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
	thresholds: {
		// Pass/fail for one run; the report's per-minute timeline shows where it tipped.
		http_req_failed: [
			{ threshold: 'rate<0.01' },
			{ threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '1m' }
		],
		remote_errors: ['rate<0.01'],
		'http_req_duration{name:tile:trench}': ['p(95)<1000'],
		'http_req_duration{name:page:map}': ['p(95)<2000'],
		'http_req_duration{name:remote:searchFeatures}': ['p(95)<1500']
	}
};

/**
 * Discovers projects and sample features once for all virtual users.
 * @returns {ReturnType<typeof discover>}
 */
export function setup() {
	if (tokens.length === 0) throw new Error(`No users in ${config.tokensFile}`);
	return discover(tokens[0].token);
}

/** Signs this VU in as its own load-test user (one per VU, wrapping around). */
function signInVu() {
	const user = tokens[(exec.vu.idInTest - 1) % tokens.length];
	signIn(user.token);
}

/** @param {ReturnType<typeof discover>} data */
export function map(data) {
	signInVu();
	mapSession(data);
}

/** @param {ReturnType<typeof discover>} data */
export function search(data) {
	signInVu();
	searchSession(data);
}

/** @param {ReturnType<typeof discover>} data */
export function schema(data) {
	signInVu();
	schemaSession(data);
}

/** @param {ReturnType<typeof discover>} data */
export function edit(data) {
	signInVu();
	editSession(data);
}

/**
 * Writes the machine-readable summary next to the console one.
 * @param {object} data - k6 end-of-test summary.
 * @returns {Record<string, string>}
 */
export function handleSummary(data) {
	return {
		stdout: textSummary(data, { indent: ' ', enableColors: true }),
		[__ENV.SUMMARY || 'summary.json']: JSON.stringify(data, null, 2)
	};
}
