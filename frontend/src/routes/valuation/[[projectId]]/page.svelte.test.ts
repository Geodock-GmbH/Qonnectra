import '@testing-library/jest-dom/vitest';

import type { ValuationArea } from '$lib/remote/valuation/valuation-data';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import Page from './+page.svelte';

const { pageState, remote } = vi.hoisted(() => ({
	pageState: { params: { projectId: '1' as string | undefined }, data: {} },
	remote: {
		getValuationAreas: vi.fn(),
		getValuationRateCount: vi.fn(),
		calculateValuation: vi.fn()
	}
}));

vi.mock('$lib/remote/valuation/valuation.remote', () => remote);

vi.mock('$app/state', () => ({ page: pageState }));

vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('$lib/stores/store', async () => {
	const { writable } = await import('svelte/store');
	return { selectedProject: writable('1'), globalMapView: writable(false) };
});

vi.mock('./components/ValuationMap.svelte', async () => ({
	default: (await import('$lib/test-utils/mocks/MockMap.svelte')).default
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

const { selectedProject, globalMapView } = await import('$lib/stores/store');

const user = userEvent.setup();

const areas: ValuationArea[] = [
	{ uuid: 'area-1', name: 'Nord', areaType: 'Cluster', geometry: null }
];

const result = {
	categories: [{ name: 'Tiefbau', unit: 'per_meter', amount: 100, quantity: 10, totalPrice: 1000 }],
	total: 1000,
	costPerHouseConnection: null,
	costPerMeter: 100
};

/** Renders the page, picks the area and calculates, so there is state to reset. */
async function renderCalculatedPage() {
	render(Page);

	await user.click(await screen.findByRole('checkbox', { name: 'Nord' }));
	await user.click(await screen.findByRole('button', { name: 'valuation_calculate' }));
	await screen.findByText('Tiefbau');
}

beforeEach(() => {
	pageState.params.projectId = '1';
	selectedProject.set('1');
	globalMapView.set(false);
	remote.getValuationAreas.mockResolvedValue(areas);
	remote.getValuationRateCount.mockResolvedValue(2);
	remote.calculateValuation.mockResolvedValue(result);
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('Valuation page', () => {
	test('should start with the whole project selected and no result', async () => {
		render(Page);

		expect(screen.getByRole('checkbox', { name: 'valuation_area_gesamt' })).toBeChecked();
		expect(await screen.findByRole('checkbox', { name: 'Nord' })).not.toBeChecked();
		expect(screen.queryByText('valuation_total')).not.toBeInTheDocument();
	});

	test('should adopt the project of a deep link before anything is loaded', async () => {
		pageState.params.projectId = '5';

		render(Page);

		await screen.findByRole('checkbox', { name: 'Nord' });
		const { get } = await import('svelte/store');
		expect(get(selectedProject)).toBe('5');
		expect(remote.getValuationAreas).toHaveBeenCalledWith({ projectId: '5' });
		expect(remote.getValuationRateCount).toHaveBeenCalledWith({ projectId: '5' });
	});

	test('should calculate the selected areas and list the priced cost rates', async () => {
		await renderCalculatedPage();

		expect(remote.calculateValuation).toHaveBeenCalledWith({
			projectId: '1',
			areaUuids: ['area-1']
		});
		expect(screen.getByRole('checkbox', { name: 'valuation_area_gesamt' })).not.toBeChecked();
		expect(screen.getByText('valuation_total')).toBeInTheDocument();
	});

	test('should project the result over the years following the base year', async () => {
		await renderCalculatedPage();

		const baseYear = screen.getByLabelText('valuation_base_year');
		await user.clear(baseYear);
		await user.type(baseYear, '2030');

		expect(await screen.findByRole('cell', { name: '2030' })).toBeInTheDocument();
		expect(screen.getByRole('cell', { name: '2051' })).toBeInTheDocument();
		expect(remote.calculateValuation).toHaveBeenCalledTimes(1);
	});

	test('should drop the selection and the result when the project changes', async () => {
		await renderCalculatedPage();

		pageState.params.projectId = '2';
		selectedProject.set('2');

		await vi.waitFor(() => expect(screen.queryByText('Tiefbau')).not.toBeInTheDocument());
		expect(screen.getByRole('checkbox', { name: 'valuation_area_gesamt' })).toBeChecked();
	});

	test('should drop the selection and the result when the global view is toggled', async () => {
		await renderCalculatedPage();

		globalMapView.set(true);

		await vi.waitFor(() => expect(screen.queryByText('Tiefbau')).not.toBeInTheDocument());
		expect(screen.getByRole('checkbox', { name: 'valuation_area_gesamt' })).toBeChecked();
		await vi.waitFor(() =>
			expect(remote.getValuationAreas).toHaveBeenLastCalledWith({ projectId: '' })
		);
	});
});
