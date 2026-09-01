import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { drawerStore } from '$lib/stores/drawer';

import NetworkSchemaSearch from './NetworkSchemaSearch.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

const setCenterMock = vi.hoisted(() => vi.fn());

vi.mock('@xyflow/svelte', () => ({
	useSvelteFlow: () => ({ setCenter: setCenterMock })
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

vi.mock('./DrawerTabs.svelte', () => ({
	default: () => {}
}));

/**
 * Build a minimal search manager stand-in matching the properties the component reads.
 */
function makeSearchManager(overrides: Record<string, unknown> = {}) {
	return {
		searchTerm: '',
		searchResults: [
			{ id: 'node-1', name: 'PoP-Nord', type: 'node' },
			{ id: 'cable-1', name: 'K-Süd', type: 'edge' }
		],
		panToResult: true,
		highlightResult: true,
		openDrawer: true,
		clearSearch: vi.fn(function (this: { searchTerm: string }) {
			this.searchTerm = '';
		}),
		getResultPosition: vi.fn(() => ({ x: 10, y: 20 })),
		...overrides
	} as any;
}

function makeSchemaState() {
	return {
		selectNode: vi.fn(),
		selectEdge: vi.fn(),
		updateNodeName: vi.fn(),
		updateEdgeName: vi.fn(),
		loadNodeDetails: vi.fn().mockResolvedValue({ properties: { name: 'PoP-Nord' } }),
		loadCableDetails: vi.fn().mockResolvedValue({ name: 'K-Süd', uuid: 'cable-1' })
	} as any;
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	setCenterMock.mockReset();
	drawerStore.close();
});

describe('NetworkSchemaSearch', () => {
	test('should render the search input without a dropdown until typing', () => {
		render(NetworkSchemaSearch, {
			searchManager: makeSearchManager(),
			schemaState: makeSchemaState()
		});

		expect(screen.getByPlaceholderText('common_search')).toBeInTheDocument();
		// Results exist in the manager but the dropdown is closed until the user types.
		expect(screen.queryByText('PoP-Nord')).not.toBeInTheDocument();
	});

	test('should open the results dropdown and set the search term on input', async () => {
		const user = userEvent.setup();
		const searchManager = makeSearchManager();
		render(NetworkSchemaSearch, { searchManager, schemaState: makeSchemaState() });

		await user.type(screen.getByPlaceholderText('common_search'), 'K');

		expect(searchManager.searchTerm).toBe('K');
		expect(screen.getByText('PoP-Nord')).toBeInTheDocument();
		expect(screen.getByText('K-Süd')).toBeInTheDocument();
	});

	test('should show a no-results message when the manager returns nothing', async () => {
		const user = userEvent.setup();
		const searchManager = makeSearchManager({ searchResults: [] });
		render(NetworkSchemaSearch, { searchManager, schemaState: makeSchemaState() });

		await user.type(screen.getByPlaceholderText('common_search'), 'zzz');

		expect(screen.getByText('message_no_results_found')).toBeInTheDocument();
	});

	test('should select a node result: pan, highlight, and open the node drawer', async () => {
		const user = userEvent.setup();
		const searchManager = makeSearchManager();
		const schemaState = makeSchemaState();
		const openSpy = vi.spyOn(drawerStore, 'open');

		render(NetworkSchemaSearch, { searchManager, schemaState });

		await user.type(screen.getByPlaceholderText('common_search'), 'PoP');
		await user.click(screen.getByText('PoP-Nord'));

		expect(searchManager.getResultPosition).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'node-1' })
		);
		expect(setCenterMock).toHaveBeenCalledWith(10, 20, expect.objectContaining({ zoom: 1 }));
		expect(schemaState.selectNode).toHaveBeenCalledWith('node-1');

		await vi.waitFor(() => expect(openSpy).toHaveBeenCalled());
		expect(schemaState.loadNodeDetails).toHaveBeenCalledWith('node-1');
	});

	test('should select an edge result and fetch cable details', async () => {
		const user = userEvent.setup();
		const searchManager = makeSearchManager();
		const schemaState = makeSchemaState();

		render(NetworkSchemaSearch, { searchManager, schemaState });

		await user.type(screen.getByPlaceholderText('common_search'), 'K');
		await user.click(screen.getByText('K-Süd'));

		expect(schemaState.selectEdge).toHaveBeenCalledWith('cable-1');
		await vi.waitFor(() => expect(schemaState.loadCableDetails).toHaveBeenCalledWith('cable-1'));
	});

	test('should clear the search when the clear button is clicked', async () => {
		const user = userEvent.setup();
		const searchManager = makeSearchManager();
		render(NetworkSchemaSearch, { searchManager, schemaState: makeSchemaState() });

		await user.type(screen.getByPlaceholderText('common_search'), 'K');
		await user.click(screen.getByRole('button', { name: 'common_search' }));

		expect(searchManager.clearSearch).toHaveBeenCalled();
	});
});
