import type { TrenchConduit } from '$lib/remote/map/trench-data';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { httpError } from '$lib/test-utils/remote-stubs';

import MapConduitAccordion from './MapConduitAccordion.svelte';
import MapManagersFixture from './MapManagers.fixture.svelte';

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
	getMicroducts: (...args: unknown[]) => getMicroducts(...args)
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

const selectionManager = { selectMultipleFeatures: vi.fn() };
const user = userEvent.setup();

function renderAccordion() {
	return render(MapManagersFixture, {
		props: {
			component: MapConduitAccordion,
			props: { featureId: 'trench-1' },
			selectionManager
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
	selectionManager.selectMultipleFeatures.mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('MapConduitAccordion', () => {
	test('should list the conduits of the trench', async () => {
		renderAccordion();

		expect(await screen.findByText('DA 50 (Rohr)')).toBeInTheDocument();
		expect(screen.getByText('DA 110')).toBeInTheDocument();
		expect(getConduitsInTrench).toHaveBeenCalledWith('trench-1');
	});

	test('should say so when the trench holds no conduits', async () => {
		getConduitsInTrench.mockResolvedValue([]);

		renderAccordion();

		expect(await screen.findByText('message_no_conduits_found')).toBeInTheDocument();
	});

	test('should load the microducts of a conduit only once it is opened', async () => {
		renderAccordion();
		const title = await screen.findByText('DA 50 (Rohr)');

		expect(getMicroducts).not.toHaveBeenCalled();

		await user.click(title);

		await vi.waitFor(() => expect(getMicroducts).toHaveBeenCalledExactlyOnceWith('conduit-1'));
	});

	test('should select every trench the conduit runs through', async () => {
		renderAccordion();
		const [highlight] = await screen.findAllByRole('button', {
			name: 'action_highlight_trenches'
		});

		await user.click(highlight);

		expect(getConduitTrenches).toHaveBeenCalledWith('conduit-1');
		await vi.waitFor(() =>
			expect(selectionManager.selectMultipleFeatures).toHaveBeenCalledWith(['trench-1', 'trench-2'])
		);
		expect(getMicroducts).not.toHaveBeenCalled();
	});

	test('should toast when the trenches of a conduit cannot be loaded', async () => {
		getConduitTrenches.mockRejectedValue(httpError(500, 'boom'));
		renderAccordion();
		const [highlight] = await screen.findAllByRole('button', {
			name: 'action_highlight_trenches'
		});

		await user.click(highlight);

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalledOnce());
		expect(selectionManager.selectMultipleFeatures).not.toHaveBeenCalled();
	});

	test('should surface a failed conduit request', async () => {
		getConduitsInTrench.mockRejectedValue(httpError(502, 'Conduits unavailable'));

		renderAccordion();

		expect(await screen.findByTestId('boundary-failed')).toBeInTheDocument();
	});
});
