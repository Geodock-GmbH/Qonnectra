/**
 * Planner persona: opens the network schema (ten parallel Django loads on the
 * server), inspects nodes and cables with their fibers, and sometimes pages
 * through the conduit table.
 */
import { page, remote } from '../lib/client.js';
import { between, pick, think, weighted } from '../lib/random.js';

/**
 * Runs one planning session.
 * @param {{ projects: import('../lib/fixtures.js').ProjectFixture[] }} data - setup() fixture.
 */
export function schemaSession(data) {
	const project = /** @type {import('../lib/fixtures.js').ProjectFixture} */ (pick(data.projects));
	const projectId = String(project.id);
	const schemaPath = `/project/${project.id}/network-schema`;

	page(schemaPath, 'page:network-schema');

	const actions = between(3, 8);
	for (let i = 0; i < actions; i++) {
		think(2, 6);
		const action = weighted({ node: 5, cable: 3, conduits: 2 });
		if (action === 'node') {
			const uuid = pick(project.features.node);
			if (uuid) remote('getNodeDetails', uuid, schemaPath);
		} else if (action === 'cable') {
			const uuid = pick(project.features.cable);
			if (!uuid) continue;
			remote('getCableDetails', uuid, schemaPath);
			remote('getFibersForCable', uuid, schemaPath);
		} else {
			const conduitPath = `/project/${project.id}/conduit`;
			page(conduitPath, 'page:conduit');
			remote(
				'getConduitList',
				{ projectId, search: '', page: between(1, 5), pageSize: 50 },
				conduitPath
			);
		}
	}
}
