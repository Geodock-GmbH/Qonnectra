import type { TrenchConduit } from '$lib/remote/map/trench-data';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { httpError } from '$lib/test-utils/remote-stubs';
import { remoteQueryStub } from '$lib/test-utils/remoteQueryStub';

import { NodeAssignmentManager } from '../NodeAssignmentManager.svelte';
import HouseConnectionAccordion from './HouseConnectionAccordion.svelte';
import HouseConnectionContextFixture from './HouseConnectionContext.fixture.svelte';
import { LinkedTrenchHighlights } from '../linkedTrenchHighlights';

const getConduitsInTrench = vi.fn();
const getConduitTrenches = vi.fn();
const getMicroducts = vi.fn();

vi.mock('$lib/remote/map/trenches.remote', () => ({
	getConduitsInTrench: (...args: unknown[]) => getConduitsInTrench(...args)
}));

vi.mock('$lib/remote/map/feature-search.remote', () => ({
	getConduitTrenches: (...args: unknown[]) => getConduitTrenches(...args)
}));

vi.mock('$lib/remote/conduit/microducts.remote', () => ({
	getMicroducts: (...args: unknown[]) => remoteQueryStub(getMicroducts)(...args)
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
		error: vi.fn()
	}
}));

vi.mock('$lib/utils/logToBackendClient', () => ({
	logToBackendClient: vi.fn().mockResolvedValue(undefined)
}));

const conduits: TrenchConduit[] = [
	{
		uuid: 'connection-1',
		conduit: { uuid: 'conduit-1', name: 'DA 50', conduit_type: { conduit_type: 'Rohr' } }
	},
	{ uuid: 'connection-2', conduit: { uuid: 'conduit-2', name: 'DA 110' } }
];

const highlights = new LinkedTrenchHighlights();
const trenchHighlights = {
	show: vi.spyOn(highlights, 'show'),
	hide: vi.spyOn(highlights, 'hide'),
	clear: vi.spyOn(highlights, 'clear')
};
const nodeAssignment = new NodeAssignmentManager({
	olMap: null,
	layers: {},
	selectableLayersConfig: { trench: true, address: false, node: false },
	handleFeatureClick: vi.fn()
});
const user = userEvent.setup();

function renderAccordion() {
	return render(HouseConnectionContextFixture, {
		props: {
			component: HouseConnectionAccordion,
			props: { featureId: 'trench-1' },
			context: { trenchHighlights: highlights, nodeAssignment }
		}
	});
}

beforeEach(() => {
	getConduitsInTrench.mockResolvedValue(conduits);
	getConduitTrenches.mockResolvedValue({ trenches: [], trenchUuids: ['trench-1', 'trench-2'] });
	getMicroducts.mockResolvedValue([{ uuid: 'md-1', number: 1, color: 'rot' }]);
});

afterEach(() => {
	getConduitsInTrench.mockReset();
	getConduitTrenches.mockReset();
	getMicroducts.mockReset();
	highlights.clear();
	trenchHighlights.show.mockClear();
	trenchHighlights.hide.mockClear();
	trenchHighlights.clear.mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('HouseConnectionAccordion', () => {
	test('should list the conduits of the trench', async () => {
		renderAccordion();

		expect(await screen.findByText('DA 50 (Rohr)')).toBeInTheDocument();
		expect(screen.getByText('DA 110')).toBeInTheDocument();
		expect(getConduitsInTrench).toHaveBeenCalledWith('trench-1');
	});

	test('should say so when the trench holds no conduits', async () => {
		getConduitsInTrench.mockResolvedValue([]);

		renderAccordion();

		expect(await screen.findByText('message_no_conduits_found_in_trench')).toBeInTheDocument();
	});

	test('should load the microducts of a conduit only once it is opened', async () => {
		renderAccordion();
		const title = await screen.findByText('DA 50 (Rohr)');

		expect(getMicroducts).not.toHaveBeenCalled();

		await user.click(title);

		expect(await screen.findByText('rot')).toBeInTheDocument();
		expect(getMicroducts).toHaveBeenCalledExactlyOnceWith('conduit-1');
	});

	test('should highlight every trench of an opened conduit', async () => {
		renderAccordion();

		await user.click(await screen.findByText('DA 50 (Rohr)'));

		await vi.waitFor(() =>
			expect(trenchHighlights.show).toHaveBeenCalledExactlyOnceWith('conduit-1', [
				'trench-1',
				'trench-2'
			])
		);
		expect(getConduitTrenches).toHaveBeenCalledExactlyOnceWith('conduit-1');
	});

	test('should drop the highlight when the conduit is closed again', async () => {
		renderAccordion();
		const title = await screen.findByText('DA 50 (Rohr)');
		await user.click(title);
		await vi.waitFor(() => expect(trenchHighlights.show).toHaveBeenCalled());

		await user.click(title);

		expect(trenchHighlights.hide).toHaveBeenCalledExactlyOnceWith('conduit-1');
	});

	test('should not highlight a conduit that was closed while its trenches loaded', async () => {
		let resolveTrenches: (value: { trenches: never[]; trenchUuids: string[] }) => void = () => {};
		getConduitTrenches.mockReturnValue(
			new Promise((resolve) => {
				resolveTrenches = resolve;
			})
		);
		renderAccordion();
		const title = await screen.findByText('DA 50 (Rohr)');

		await user.click(title);
		await user.click(title);
		resolveTrenches({ trenches: [], trenchUuids: ['trench-1'] });

		await vi.waitFor(() => expect(trenchHighlights.hide).toHaveBeenCalledWith('conduit-1'));
		expect(trenchHighlights.show).not.toHaveBeenCalled();
	});

	test('should toast when the trenches of a conduit cannot be loaded', async () => {
		getConduitTrenches.mockRejectedValue(httpError(500, 'boom'));
		renderAccordion();

		await user.click(await screen.findByText('DA 50 (Rohr)'));

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalledOnce());
		expect(trenchHighlights.show).not.toHaveBeenCalled();
	});

	test('should reload the microducts of a conduit on refresh without toggling it', async () => {
		renderAccordion();
		await user.click(await screen.findByText('DA 50 (Rohr)'));
		await screen.findByText('rot');
		getMicroducts.mockClear();
		const [refresh] = screen.getAllByRole('button', { name: 'tooltip_refresh_microducts' });

		await user.click(refresh);

		await vi.waitFor(() => expect(getMicroducts).toHaveBeenCalledExactlyOnceWith('conduit-1'));
		expect(trenchHighlights.hide).not.toHaveBeenCalled();
	});

	test('should clear every highlight when the drawer content goes away', async () => {
		const { unmount } = renderAccordion();
		await screen.findByText('DA 50 (Rohr)');

		unmount();

		await vi.waitFor(() => expect(trenchHighlights.clear).toHaveBeenCalledOnce());
	});

	test('should surface a failed conduit request', async () => {
		getConduitsInTrench.mockRejectedValue(httpError(502, 'Conduits unavailable'));

		renderAccordion();

		expect(await screen.findByTestId('boundary-failed')).toBeInTheDocument();
	});
});
