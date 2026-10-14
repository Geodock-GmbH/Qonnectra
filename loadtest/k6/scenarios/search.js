/**
 * Search persona: types into the map's search panel (debounced, so one call
 * per typing pause, each fanning out to five Django searches), then opens a
 * result.
 */
import { remote } from '../lib/client.js';
import { between, pick, think } from '../lib/random.js';

/** Terms that hit seeded data (streets, house connections, manholes) and real data. */
const TERMS = [
	'Lastweg 1',
	'Teststraße 4',
	'HA Lastweg',
	'K003',
	'Haupt',
	'Schul',
	'Berg',
	'NVt',
	'12'
];

/**
 * Runs one search session.
 * @param {{ projects: import('../lib/fixtures.js').ProjectFixture[] }} data - setup() fixture.
 */
export function searchSession(data) {
	const project = /** @type {import('../lib/fixtures.js').ProjectFixture} */ (pick(data.projects));
	const pagePath = `/project/${project.id}/map`;
	const projectId = String(project.id);
	const term = /** @type {string} */ (pick(TERMS));

	const pauses = between(1, 3);
	for (let i = 1; i <= pauses; i++) {
		const typed = term.slice(0, Math.max(2, Math.ceil((term.length * i) / pauses)));
		remote('searchFeatures', { searchQuery: typed, projectId }, pagePath);
		think(0.4, 1.5);
	}

	const kind = pick(
		/** @type {('trench' | 'node' | 'address')[]} */ (['trench', 'node', 'address'])
	);
	const uuid = pick(project.features[/** @type {'trench'} */ (kind)]);
	if (uuid) {
		remote('getFeatureDetails', { featureType: kind, featureUuid: uuid, projectId }, pagePath);
	}
	think(3, 8);
}
