import type { TrenchCable } from '$lib/remote/map/trench-data';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { httpError } from '$lib/test-utils/remote-stubs';

import MapCableAccordion from './MapCableAccordion.svelte';
import MapManagersFixture from './MapManagers.fixture.svelte';
import { traceFrom } from '../../../../trace/traceUtils';

const getCablesInTrench = vi.fn();
const getLinkedTrenchesForCable = vi.fn();
const getFibersForCable = vi.fn();

vi.mock('$lib/remote/map/trenches.remote', () => ({
	getCablesInTrench: (...args: unknown[]) => getCablesInTrench(...args)
}));

vi.mock('$lib/remote/network-schema/micropipes.remote', () => ({
	getLinkedTrenchesForCable: (...args: unknown[]) => getLinkedTrenchesForCable(...args)
}));

vi.mock('$lib/remote/network-schema/fibers.remote', () => ({
	getFibersForCable: (...args: unknown[]) => getFibersForCable(...args),
	getFiberColors: vi.fn().mockResolvedValue([])
}));

vi.mock('../../../../trace/traceUtils', () => ({ traceFrom: vi.fn() }));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

vi.mock('$lib/paraglide/runtime', () => ({ getLocale: () => 'de' }));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

vi.mock('$lib/utils/logToBackendClient', () => ({
	logToBackendClient: vi.fn().mockResolvedValue(undefined)
}));

const cables: TrenchCable[] = [
	{ uuid: 'cable-1', name: 'K-01', cable_type: { cable_type: '48F' }, fiber_count: 48 },
	{ uuid: 'cable-2', name: 'K-02', cable_type: null }
];

const selectionManager = { selectMultipleFeatures: vi.fn() };
const user = userEvent.setup();

function renderAccordion() {
	return render(MapManagersFixture, {
		props: {
			component: MapCableAccordion,
			props: { featureId: 'trench-1' },
			selectionManager
		}
	});
}

beforeEach(() => {
	getCablesInTrench.mockResolvedValue(cables);
	getLinkedTrenchesForCable.mockResolvedValue(['trench-1', 'trench-2']);
	getFibersForCable.mockResolvedValue([]);
});

afterEach(() => {
	getCablesInTrench.mockReset();
	getLinkedTrenchesForCable.mockReset();
	getFibersForCable.mockReset();
	selectionManager.selectMultipleFeatures.mockClear();
	vi.mocked(globalToaster.error).mockClear();
	vi.mocked(traceFrom).mockClear();
});

describe('MapCableAccordion', () => {
	test('should list the cables of the trench with their fiber counts', async () => {
		renderAccordion();

		expect(await screen.findByText('K-01 (48F)')).toBeInTheDocument();
		expect(screen.getByText('K-02')).toBeInTheDocument();
		expect(screen.getByText(/^48\s+form_fibers$/)).toBeInTheDocument();
		expect(screen.getByText(/^0\s+form_fibers$/)).toBeInTheDocument();
		expect(getCablesInTrench).toHaveBeenCalledWith('trench-1');
	});

	test('should say so when no cable passes through the trench', async () => {
		getCablesInTrench.mockResolvedValue([]);

		renderAccordion();

		expect(await screen.findByText('message_no_cables_in_trench')).toBeInTheDocument();
	});

	test('should load the fibers of a cable only once it is opened', async () => {
		renderAccordion();
		const title = await screen.findByText('K-01 (48F)');

		expect(getFibersForCable).not.toHaveBeenCalled();

		await user.click(title);

		await vi.waitFor(() => expect(getFibersForCable).toHaveBeenCalledExactlyOnceWith('cable-1'));
	});

	test('should select every trench the cable is linked to', async () => {
		renderAccordion();
		const [highlight] = await screen.findAllByRole('button', {
			name: 'action_highlight_trenches'
		});

		await user.click(highlight);

		expect(getLinkedTrenchesForCable).toHaveBeenCalledWith('cable-1');
		await vi.waitFor(() =>
			expect(selectionManager.selectMultipleFeatures).toHaveBeenCalledWith(['trench-1', 'trench-2'])
		);
	});

	test('should leave the selection alone when the cable has no linked trenches', async () => {
		getLinkedTrenchesForCable.mockResolvedValue([]);
		renderAccordion();
		const [highlight] = await screen.findAllByRole('button', {
			name: 'action_highlight_trenches'
		});

		await user.click(highlight);

		await vi.waitFor(() => expect(highlight).toBeEnabled());
		expect(selectionManager.selectMultipleFeatures).not.toHaveBeenCalled();
	});

	test('should toast when the linked trenches cannot be loaded', async () => {
		getLinkedTrenchesForCable.mockRejectedValue(httpError(500, 'boom'));
		renderAccordion();
		const [highlight] = await screen.findAllByRole('button', {
			name: 'action_highlight_trenches'
		});

		await user.click(highlight);

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalledOnce());
	});

	test('should start a trace from the cable', async () => {
		renderAccordion();
		const [trace] = await screen.findAllByRole('button', { name: 'action_trace' });

		await user.click(trace);

		expect(traceFrom).toHaveBeenCalledExactlyOnceWith('cable', 'cable-1');
		expect(getFibersForCable).not.toHaveBeenCalled();
	});
});
