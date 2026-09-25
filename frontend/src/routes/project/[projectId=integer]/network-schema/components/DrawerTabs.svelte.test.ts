import { goto } from '$app/navigation';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import SchemaDrawerBodyFixture from './SchemaDrawerBody.fixture.svelte';

// The panel contents load node structures and a map; a stub that reads its
// feature once, like they do, shows which feature a panel was mounted for.
vi.mock(
	'$lib/components/node-structure/NodeSlotConfigPanel.svelte',
	() => import('./SchemaPanelContent.fixture.svelte')
);
vi.mock(
	'$lib/components/node-structure/NodeStructurePanel.svelte',
	() => import('./SchemaPanelContent.fixture.svelte')
);
vi.mock('./CableMicropipePanel.svelte', () => import('./SchemaPanelContent.fixture.svelte'));

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$app/forms', () => ({
	deserialize: vi.fn((text: string) => JSON.parse(text))
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

const pageState = vi.hoisted(() => ({
	value: {
		url: new URL('http://localhost/network-schema/7'),
		params: { projectId: '7' },
		data: {}
	}
}));

const statePage = vi.hoisted(() => ({ current: null as unknown as { url: URL } }));

vi.mock('$app/state', async () => {
	const { pageStub } = await import('$lib/test-utils/pageStub');
	statePage.current = pageStub({
		params: { projectId: '7' },
		url: 'http://localhost/project/7/network-schema'
	});
	return { page: statePage.current };
});

const fiberRemote = vi.hoisted(() => ({
	getFibersForCable: vi.fn(),
	getFiberColors: vi.fn(),
	getFiberStatusOptions: vi.fn()
}));

vi.mock('$lib/remote/network-schema/fibers.remote', async () => {
	const { remoteQueryStub } = await import('$lib/test-utils/remoteQueryStub');
	const empty = () => remoteQueryStub(vi.fn().mockResolvedValue([]));
	return {
		getCablesAtNode: empty(),
		getFibersForCable: (...a: unknown[]) => fiberRemote.getFibersForCable(...a),
		getFiberColors: (...a: unknown[]) => fiberRemote.getFiberColors(...a),
		getFiberUsageInNode: empty(),
		getAddressesForNode: empty(),
		getUsedResidentialUnits: empty(),
		getFiberStatusOptions: (...a: unknown[]) => fiberRemote.getFiberStatusOptions(...a),
		updateFiberStatus: vi.fn()
	};
});

vi.mock('$app/stores', () => ({
	page: {
		subscribe(run: (value: unknown) => void) {
			run(pageState.value);
			return () => {};
		}
	}
}));

vi.mock('$env/static/public', () => ({
	PUBLIC_API_URL: 'http://mock-api.test/'
}));

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_API_URL: 'http://mock-api.test/' }
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn(),
		warning: vi.fn()
	}
}));

vi.mock('$lib/utils/contentTypes', () => ({
	fetchContentTypes: vi.fn(() => Promise.resolve({})),
	getContentTypeId: vi.fn(() => 1)
}));

const fetchMock = vi.fn();

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	fetchMock.mockResolvedValue({
		ok: true,
		text: () => Promise.resolve(JSON.stringify({ type: 'success', data: {} })),
		json: () => Promise.resolve([])
	});
	vi.spyOn(console, 'error').mockImplementation(() => {});
	fiberRemote.getFibersForCable.mockResolvedValue([]);
	fiberRemote.getFiberColors.mockResolvedValue([]);
	fiberRemote.getFiberStatusOptions.mockResolvedValue([{ id: 1, fiber_status: 'defekt' }]);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
	Object.values(fiberRemote).forEach((fn) => fn.mockReset());
	statePage.current.url = new URL('http://localhost/project/7/network-schema');
});

describe('DrawerTabs', () => {
	test('should show edge tabs for cables', async () => {
		render(SchemaDrawerBodyFixture, { drawerProps: { kind: 'cable', id: 'cable-1' } });

		expect(await screen.findByRole('tab', { name: 'common_attributes' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'form_status' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'form_handles' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'form_actions' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'form_attachments' })).toBeInTheDocument();
	});

	test('should show node tabs without cable-specific entries', async () => {
		render(SchemaDrawerBodyFixture, { drawerProps: { kind: 'node', id: 'node-1' } });

		expect(await screen.findByRole('tab', { name: 'common_attributes' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'form_actions' })).toBeInTheDocument();
		expect(screen.queryByRole('tab', { name: 'form_status' })).not.toBeInTheDocument();
		expect(screen.queryByRole('tab', { name: 'form_handles' })).not.toBeInTheDocument();
	});

	test('should load the fibers and their status options when opened on the status tab', async () => {
		statePage.current.url = new URL(
			'http://localhost/project/7/network-schema?feature=cable:cable-1&tab=status'
		);

		render(SchemaDrawerBodyFixture, { drawerProps: { kind: 'cable', id: 'cable-1' } });

		expect(await screen.findByRole('tab', { name: 'form_status' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await vi.waitFor(() => expect(fiberRemote.getFiberStatusOptions).toHaveBeenCalled());
		expect(fiberRemote.getFibersForCable).toHaveBeenCalledWith('cable-1');
	});

	test('should select the attributes tab by default', async () => {
		render(SchemaDrawerBodyFixture, { drawerProps: { kind: 'node', id: 'node-1' } });

		expect(await screen.findByRole('tab', { name: 'common_attributes' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
	});

	test('should open a cable on the tab carried over in the URL', async () => {
		statePage.current.url = new URL(
			'http://localhost/project/7/network-schema?feature=cable:cable-2&tab=handles'
		);

		render(SchemaDrawerBodyFixture, { drawerProps: { kind: 'cable', id: 'cable-2' } });

		expect(await screen.findByRole('tab', { name: 'form_handles' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
	});

	test('should fall back to attributes for a carried-over tab a node lacks, keeping the URL', async () => {
		vi.mocked(goto).mockClear();
		statePage.current.url = new URL(
			'http://localhost/project/7/network-schema?feature=node:node-1&tab=handles'
		);

		render(SchemaDrawerBodyFixture, { drawerProps: { kind: 'node', id: 'node-1' } });

		expect(await screen.findByRole('tab', { name: 'common_attributes' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		expect(goto).not.toHaveBeenCalled();
	});
});

describe('drawer floating panels', () => {
	beforeEach(() => {
		statePage.current.url = new URL('http://localhost/project/7/network-schema?tab=actions');
	});

	/**
	 * Clicks an action button once the drawer's record has loaded.
	 * @param name - The button's accessible name.
	 */
	async function clickAction(name: string) {
		await fireEvent.click(await screen.findByRole('button', { name }));
	}

	test('should keep the structure panel open for the next node and load that node', async () => {
		const { rerender } = render(SchemaDrawerBodyFixture, {
			drawerProps: { kind: 'node', id: 'node-1' }
		});
		await clickAction('action_configure_structure');
		expect(await screen.findByText('content for node-1')).toBeInTheDocument();

		await rerender({ drawerProps: { kind: 'node', id: 'node-2' } });

		expect(await screen.findByText('content for node-2')).toBeInTheDocument();
		expect(screen.getByText('title_node_structure')).toBeInTheDocument();
		expect(screen.queryByText('content for node-1')).not.toBeInTheDocument();
	});

	test('should close the node panels when a cable is selected', async () => {
		const { rerender } = render(SchemaDrawerBodyFixture, {
			drawerProps: { kind: 'node', id: 'node-1' }
		});
		await clickAction('action_configure_slots');
		expect(await screen.findByText('title_slot_configuration')).toBeInTheDocument();

		await rerender({ drawerProps: { kind: 'cable', id: 'cable-1' } });
		await screen.findByRole('button', { name: 'action_link_micropipes' });
		expect(screen.queryByText('title_slot_configuration')).not.toBeInTheDocument();

		await rerender({ drawerProps: { kind: 'node', id: 'node-2' } });
		await screen.findByRole('button', { name: 'action_configure_slots' });
		expect(screen.queryByText('title_slot_configuration')).not.toBeInTheDocument();
	});

	test('should not carry a slot configuration picked on one node over to the next', async () => {
		const { rerender } = render(SchemaDrawerBodyFixture, {
			drawerProps: { kind: 'node', id: 'node-1' }
		});
		await clickAction('action_configure_slots');
		await fireEvent.click(await screen.findByRole('button', { name: 'view structure' }));
		expect(await screen.findByText('starts on slot-9')).toBeInTheDocument();

		await rerender({ drawerProps: { kind: 'node', id: 'node-2' } });

		expect(await screen.findAllByText('content for node-2')).toHaveLength(2);
		expect(screen.queryByText('starts on slot-9')).not.toBeInTheDocument();
	});

	test('should keep the micropipe panel open for the next cable and load that cable', async () => {
		const { rerender } = render(SchemaDrawerBodyFixture, {
			drawerProps: { kind: 'cable', id: 'cable-1' }
		});
		await clickAction('action_link_micropipes');
		expect(await screen.findByText('content for cable-1')).toBeInTheDocument();

		await rerender({ drawerProps: { kind: 'cable', id: 'cable-2' } });

		expect(await screen.findByText('content for cable-2')).toBeInTheDocument();
		expect(screen.getByText('title_cable_micropipe_linking')).toBeInTheDocument();
	});
});
