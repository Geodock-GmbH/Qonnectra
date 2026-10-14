/**
 * Editor persona (WRITES=1 only): edits trench attributes and creates and
 * deletes a conduit, which fires the trench triggers, history rows and the
 * microduct generation signal. Only ever touches seeded loadtest-* projects
 * and deletes what it creates.
 */
import { apiWrite } from '../lib/client.js';
import { pick, think } from '../lib/random.js';

/**
 * Runs one editing session.
 * @param {{ projects: import('../lib/fixtures.js').ProjectFixture[], conduitTypeId: number | null, flagId: number | null }} data
 */
export function editSession(data) {
	const project = pick(data.projects.filter((p) => p.isLoadtest));
	if (!project) {
		think(30, 30);
		return;
	}

	const trench = pick(project.features.trench);
	if (trench) {
		apiWrite('PATCH', `trench/${trench}/`, 'write:trench-patch', {
			comment: `loadtest ${new Date().toISOString()}`
		});
	}
	think(5, 15);

	if (data.conduitTypeId === null || data.flagId === null) return;
	const created = apiWrite('POST', 'conduit/', 'write:conduit-create', {
		name: `loadtest-${__VU}-${__ITER}-${Date.now()}`,
		conduit_type_id: data.conduitTypeId,
		project_id: project.id,
		flag_id: data.flagId
	});
	let uuid = null;
	try {
		const body = JSON.parse(String(created.body));
		uuid = body.uuid ?? body.id ?? null;
	} catch {
		uuid = null;
	}
	think(3, 10);
	if (uuid) apiWrite('DELETE', `conduit/${uuid}/`, 'write:conduit-delete');
}
