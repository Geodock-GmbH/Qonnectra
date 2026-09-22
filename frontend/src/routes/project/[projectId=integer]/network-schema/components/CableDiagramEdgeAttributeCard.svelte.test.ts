import { render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { drawerStore } from '$lib/stores/drawer';
import { globalToaster } from '$lib/stores/toaster';

import CableDiagramEdgeAttributeCard from './CableDiagramEdgeAttributeCard.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

// Cable reads/writes run through the cables.remote module; mock it so the
// component's calls are observable without a running server.
const getConduitsForCable = vi.fn();
const getCableSplices = vi.fn();
const updateCable = vi.fn();
const deleteCable = vi.fn();

vi.mock('$lib/remote/network-schema/cables.remote', () => ({
	getConduitsForCable: (...args: unknown[]) => getConduitsForCable(...args),
	getCableSplices: (...args: unknown[]) => getCableSplices(...args),
	updateCable: (...args: unknown[]) => updateCable(...args),
	deleteCable: (...args: unknown[]) => deleteCable(...args)
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

const cable = {
	uuid: 'cable-1',
	name: 'K-Nord',
	length: 120,
	length_total: 140,
	cable_type: { id: 1, cable_type: 'LWL 96', fiber_count: 96 },
	status: { id: 2 },
	network_level: { id: 3 }
};

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	getConduitsForCable.mockReturnValue({ current: [], loading: false, error: undefined });
	getCableSplices.mockResolvedValue([]);
	updateCable.mockResolvedValue({});
	deleteCable.mockResolvedValue(undefined);
	drawerStore.open({ props: cable });
});

afterEach(() => {
	vi.restoreAllMocks();
	getConduitsForCable.mockReset();
	getCableSplices.mockReset();
	updateCable.mockReset();
	deleteCable.mockReset();
	drawerStore.close();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('CableDiagramEdgeAttributeCard', () => {
	test('should prefill the form from the drawer cable and render connected conduits', () => {
		getConduitsForCable.mockReturnValue({
			current: ['DA 50', 'DA 32'],
			loading: false,
			error: undefined
		});

		render(CableDiagramEdgeAttributeCard, {});

		expect(screen.getByDisplayValue('K-Nord')).toBeInTheDocument();
		expect(getConduitsForCable).toHaveBeenCalledWith('cable-1');
		expect(screen.getByDisplayValue('DA 50, DA 32')).toBeInTheDocument();
		expect(screen.getByDisplayValue('120')).toBeInTheDocument();
		expect(screen.getByDisplayValue('140')).toBeInTheDocument();
	});

	test('should submit the cable update with attribute ids and toast success', async () => {
		const onLabelUpdate = vi.fn();
		const onSaveComplete = vi.fn();

		render(CableDiagramEdgeAttributeCard, {
			onEdgeDelete: vi.fn(),
			onLabelUpdate,
			onSaveComplete
		});

		const form = document.getElementById('cable-form') as HTMLFormElement;
		form.requestSubmit();
		await vi.waitFor(() => expect(globalToaster.success).toHaveBeenCalled());

		expect(updateCable).toHaveBeenCalledWith(
			expect.objectContaining({
				cableId: 'cable-1',
				cableTypeId: 1,
				statusId: 2,
				networkLevelId: 3
			})
		);
		expect(onLabelUpdate).toHaveBeenCalledWith('K-Nord');
		expect(onSaveComplete).toHaveBeenCalled();
	});

	test('should toast an error when the update fails', async () => {
		updateCable.mockRejectedValue(new Error('nein'));

		render(CableDiagramEdgeAttributeCard, {});

		const form = document.getElementById('cable-form') as HTMLFormElement;
		form.requestSubmit();

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalled());
		expect(globalToaster.success).not.toHaveBeenCalled();
	});
});
