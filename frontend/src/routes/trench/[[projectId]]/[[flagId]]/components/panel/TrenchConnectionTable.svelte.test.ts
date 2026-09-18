import '@testing-library/jest-dom/vitest';

import type { TrenchMapManagers } from '../trenchMapContext';
import type { TrenchConnection } from '$lib/remote/trench/connection-data';
import type { OverrideStub } from '$lib/test-utils/remote-stubs';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { zoomToFeature } from '$lib/map/searchUtils';
import { globalToaster } from '$lib/stores/toaster';
import {
	commandFailure,
	commandResult,
	httpError,
	queryResult
} from '$lib/test-utils/remote-stubs';

import { TrenchAssignmentState } from '../TrenchAssignmentState.svelte';
import TrenchContextFixture from '../TrenchContext.fixture.svelte';
import TrenchConnectionTable from './TrenchConnectionTable.svelte';

const getTrenchConnections = vi.fn();
const deleteTrenchConnection = vi.fn();
const getTrenchGeometry = vi.fn();

vi.mock('$lib/remote/trench/connections.remote', () => ({
	getTrenchConnections: (...args: unknown[]) => getTrenchConnections(...args),
	deleteTrenchConnection: (...args: unknown[]) => deleteTrenchConnection(...args)
}));

vi.mock('$lib/remote/trench/routing.remote', () => ({
	getTrenchGeometry: (...args: unknown[]) => getTrenchGeometry(...args)
}));

vi.mock('$app/state', () => ({
	page: { data: { srid: 25832, proj4Def: '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs' } }
}));

vi.mock('$lib/map/searchUtils', () => ({
	parseFeatureGeometry: vi.fn().mockResolvedValue({ getExtent: () => [0, 0, 1, 1] }),
	zoomToFeature: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/stores/store', () => ({ selectedConduit: { set: vi.fn() } }));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }
}));

vi.mock('$lib/utils/logToBackendClient', () => ({
	logToBackendClient: vi.fn().mockResolvedValue(undefined)
}));

const user = userEvent.setup();

const connections: TrenchConnection[] = [
	{ uuid: 'connection-10', trenchUuid: 'trench-10', label: 'T-10' },
	{ uuid: 'connection-2', trenchUuid: 'trench-2', label: 'T-2' },
	{ uuid: 'connection-1', trenchUuid: 'trench-1', label: 'T-1' }
];

const olMap = { getView: () => ({ getProjection: () => ({ getCode: () => 'EPSG:3857' }) }) };

/**
 * @param map - The OpenLayers map, or `null` while it is not ready.
 */
function renderTable(map: typeof olMap | null = olMap) {
	const assignment = new TrenchAssignmentState(
		{ selectFeature: vi.fn(), selectMultipleFeatures: vi.fn(), clearSelection: vi.fn() },
		'conduit-1'
	);
	const managers = { mapState: { olMap: map } } as unknown as TrenchMapManagers;
	const view = render(TrenchContextFixture, {
		props: {
			component: TrenchConnectionTable,
			props: { conduitUuid: 'conduit-1' },
			assignment,
			managers
		}
	});
	return { assignment, ...view };
}

/** The trench labels in the order the table shows them. */
function shownLabels(): string[] {
	const body = screen.getAllByRole('rowgroup')[1];
	return within(body)
		.getAllByRole('row')
		.map((row) => within(row).getAllByRole('button')[0].textContent?.trim() ?? '');
}

beforeEach(() => {
	getTrenchConnections.mockImplementation(() => queryResult(connections));
	deleteTrenchConnection.mockImplementation(() => commandResult(undefined));
	getTrenchGeometry.mockResolvedValue({
		type: 'Feature',
		geometry: { type: 'LineString', coordinates: [] }
	});
});

afterEach(() => {
	vi.clearAllMocks();
	getTrenchConnections.mockReset();
	deleteTrenchConnection.mockReset();
	getTrenchGeometry.mockReset();
});

describe('TrenchConnectionTable', () => {
	test('should show a placeholder until the conduit’s trenches arrive', async () => {
		renderTable();

		expect(screen.getByTestId('boundary-pending')).toBeInTheDocument();
		expect(await screen.findByRole('button', { name: 'T-1' })).toBeInTheDocument();
		expect(getTrenchConnections).toHaveBeenCalledWith('conduit-1');
	});

	test('should surface a failed load through the boundary', async () => {
		getTrenchConnections.mockImplementation(() => Promise.reject(new Error('Forbidden')));

		renderTable();

		expect(await screen.findByTestId('boundary-failed')).toHaveTextContent('Forbidden');
	});

	test('should say so when the conduit runs through no trench', async () => {
		getTrenchConnections.mockImplementation(() => queryResult([]));

		renderTable();

		expect(await screen.findByText('message_no_trenches')).toBeInTheDocument();
	});

	test('should sort the trench ids naturally and reverse them on demand', async () => {
		renderTable();
		await screen.findByRole('button', { name: 'T-1' });

		expect(shownLabels()).toEqual(['T-1', 'T-2', 'T-10']);

		await user.click(screen.getByRole('button', { name: 'form_trench_id' }));

		expect(shownLabels()).toEqual(['T-10', 'T-2', 'T-1']);
	});

	test('should filter by the search term and offer to clear it', async () => {
		renderTable();
		await screen.findByRole('button', { name: 'T-1' });

		await user.type(screen.getByRole('searchbox'), 't-10');
		expect(shownLabels()).toEqual(['T-10']);

		await user.click(screen.getByRole('button', { name: 'common_clear' }));
		expect(shownLabels()).toHaveLength(3);
	});

	test('should say so when the search matches nothing', async () => {
		renderTable();
		await screen.findByRole('button', { name: 'T-1' });

		await user.type(screen.getByRole('searchbox'), 'zzz');

		expect(screen.getByText('common_no_results')).toBeInTheDocument();
	});

	test('should page through more than ten trenches', async () => {
		const many = Array.from({ length: 12 }, (_, index) => ({
			uuid: `connection-${index + 1}`,
			trenchUuid: `trench-${index + 1}`,
			label: `T-${index + 1}`
		}));
		getTrenchConnections.mockImplementation(() => queryResult(many));

		renderTable();
		await screen.findByRole('button', { name: 'T-1' });

		expect(shownLabels()).toHaveLength(10);
		expect(screen.getByText(/^12\s+common_items$/)).toBeInTheDocument();
	});

	test('should highlight the conduit’s trenches on the map and drop them when it leaves', async () => {
		const { assignment, unmount } = renderTable();
		await screen.findByRole('button', { name: 'T-1' });

		expect(assignment.trenchHighlights.isHighlighted('trench-1')).toBe(true);
		expect(assignment.trenchHighlights.isHighlighted('trench-10')).toBe(true);

		unmount();

		expect(assignment.trenchHighlights.isHighlighted('trench-1')).toBe(false);
	});

	test('should zoom the map to a picked trench', async () => {
		const { assignment } = renderTable();

		await user.click(await screen.findByRole('button', { name: 'T-2' }));

		expect(getTrenchGeometry).toHaveBeenCalledWith('trench-2');
		expect(zoomToFeature).toHaveBeenCalledWith(
			olMap,
			expect.anything(),
			assignment.routeOverlay.highlightLayer,
			{ maxZoom: 20 }
		);
		expect(globalToaster.success).toHaveBeenCalledWith({
			title: 'title_trench_located',
			description: 'message_trench_located_description'
		});
	});

	test('should report a trench that cannot be located', async () => {
		getTrenchGeometry.mockRejectedValue(httpError(404, 'Trench not found'));
		renderTable();

		await user.click(await screen.findByRole('button', { name: 'T-2' }));

		expect(zoomToFeature).not.toHaveBeenCalled();
		expect(globalToaster.error).toHaveBeenCalledWith({
			title: 'title_trench_not_visible',
			description: 'message_trench_not_visible_description'
		});
	});

	test('should not look a trench up while the map is not ready', async () => {
		renderTable(null);

		await user.click(await screen.findByRole('button', { name: 'T-2' }));

		expect(getTrenchGeometry).not.toHaveBeenCalled();
		expect(globalToaster.error).toHaveBeenCalledWith({
			title: 'title_error_loading_map_features'
		});
	});

	test('should delete a connection and take its row out of the list at once', async () => {
		const updates = vi.fn();
		deleteTrenchConnection.mockImplementation(() => commandResult(undefined, updates));
		renderTable();
		await screen.findByRole('button', { name: 'T-1' });

		const row = screen.getByRole('button', { name: 'T-2' }).closest('tr') as HTMLElement;
		await user.click(within(row).getByRole('button', { name: 'common_delete' }));

		expect(deleteTrenchConnection).toHaveBeenCalledWith({
			conduitUuid: 'conduit-1',
			connectionUuid: 'connection-2'
		});
		const [override] = updates.mock.calls[0] as [OverrideStub<TrenchConnection[]>];
		expect(override.update(connections).map((connection) => connection.uuid)).toEqual([
			'connection-10',
			'connection-1'
		]);
		expect(globalToaster.success).toHaveBeenCalledWith({
			description: 'message_trench_connection_deleted'
		});
	});

	test('should report the backend’s reason when a delete is refused', async () => {
		deleteTrenchConnection.mockImplementation(() => commandFailure(httpError(403, 'Forbidden')));
		renderTable();
		await screen.findByRole('button', { name: 'T-1' });

		const row = screen.getByRole('button', { name: 'T-2' }).closest('tr') as HTMLElement;
		await user.click(within(row).getByRole('button', { name: 'common_delete' }));

		expect(globalToaster.error).toHaveBeenCalledWith({
			title: 'message_error_deleting_trench_connection',
			description: 'Forbidden'
		});
		expect(globalToaster.success).not.toHaveBeenCalled();
	});
});
