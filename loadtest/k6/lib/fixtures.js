/**
 * Discovers what the scenarios work on, once per run in `setup()`: the target
 * projects with their map extent, sample feature UUIDs to click, configured
 * WMS layers and the lookups the edit persona needs. Runs as the first load
 * test user so it sees exactly what the virtual users see.
 */
import { fail } from 'k6';
import http from 'k6/http';

import { config } from './config.js';

const SAMPLE_PAGE_SIZE = 100;

/**
 * GETs and parses a JSON API path with an explicit Bearer token.
 * @param {string} path
 * @param {string} token
 * @returns {any} Parsed body, or null on a non-2xx response.
 */
function getJson(path, token) {
	const response = http.get(`${config.apiUrl}${path}`, {
		headers: { Authorization: `Bearer ${token}` },
		responseType: 'text',
		tags: { name: 'setup' }
	});
	if (response.status < 200 || response.status >= 300) return null;
	return JSON.parse(String(response.body));
}

/**
 * Unwraps DRF pagination and GeoJSON feature collections into a plain list.
 * @param {any} body
 * @returns {any[]}
 */
function rows(body) {
	const results = body?.results ?? body;
	const list = results?.features ?? results;
	return Array.isArray(list) ? list : [];
}

/**
 * Extracts UUIDs from list rows, which are GeoJSON features or plain objects.
 * @param {any} body
 * @returns {string[]}
 */
function uuids(body) {
	return rows(body)
		.map((row) => row.id ?? row.uuid ?? row.properties?.uuid)
		.filter((id) => typeof id === 'string');
}

/**
 * Picks the projects a run targets.
 * @param {{ id: number, project: string }[]} projects
 * @returns {{ id: number, project: string }[]}
 */
function selectProjects(projects) {
	if (config.projects === 'all') return projects;
	if (config.projects === 'loadtest') {
		return projects.filter((p) => p.project.startsWith('loadtest-'));
	}
	const ids = config.projects.split(',').map(Number);
	return projects.filter((p) => ids.includes(p.id));
}

/**
 * @typedef {object} ProjectFixture
 * @property {number} id
 * @property {string} name
 * @property {boolean} isLoadtest - Seeded project, safe for writes.
 * @property {[number, number, number, number]} extent - Trench extent in EPSG:3857.
 * @property {{ trench: string[], node: string[], address: string[], cable: string[] }} features
 * @property {{ source: string, name: string, minZoom: number, maxZoom: number | null }[]} wmsLayers
 */

/**
 * Builds the shared run fixture.
 * @param {string} token - Access token of the first load-test user.
 * @returns {{ projects: ProjectFixture[], conduitTypeId: number | null, flagId: number | null }}
 */
export function discover(token) {
	const projectRows = rows(getJson('projects/?active=1&page_size=100', token));
	if (projectRows.length === 0) fail('No projects visible. Is the token valid (TOKENS, API_URL)?');

	/** @type {ProjectFixture[]} */
	const projects = [];
	for (const project of selectProjects(projectRows)) {
		const extent = getJson(`layer-extent/?layer=trench&project=${project.id}`, token)?.extent;
		if (!extent) continue;
		const sample = (/** @type {string} */ kind) =>
			uuids(getJson(`${kind}/?project=${project.id}&page_size=${SAMPLE_PAGE_SIZE}`, token));
		const wmsLayers = [];
		if (config.wms) {
			for (const source of rows(getJson(`wms-sources/?project=${project.id}`, token))) {
				if (!source.is_active) continue;
				for (const layer of source.layers ?? []) {
					if (!layer.is_enabled) continue;
					wmsLayers.push({
						source: source.id,
						name: layer.name,
						minZoom: layer.min_zoom ?? 8,
						maxZoom: layer.max_zoom ?? null
					});
				}
			}
		}
		projects.push({
			id: project.id,
			name: project.project,
			isLoadtest: project.project.startsWith('loadtest-'),
			extent,
			features: {
				trench: sample('trench'),
				node: sample('node'),
				address: sample('address'),
				cable: sample('cable')
			},
			wmsLayers
		});
	}
	if (projects.length === 0) {
		fail(`No project with trenches matches PROJECTS=${config.projects}.`);
	}

	return {
		projects,
		conduitTypeId: rows(getJson('attributes_conduit_type/', token))[0]?.id ?? null,
		flagId: rows(getJson('flags/', token))[0]?.id ?? null
	};
}
