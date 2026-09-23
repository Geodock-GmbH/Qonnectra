import '@testing-library/jest-dom/vitest';

import type { AfterNavigate } from '@sveltejs/kit';
import type { ValuationArea } from '$lib/remote/valuation/valuation-data';
import { goto } from '$app/navigation';
import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { fireAfterNavigate } from '$lib/test-utils/afterNavigateStub';
import { httpError } from '$lib/test-utils/remote-stubs';

import Page from './+page.svelte';

const { pageState, remote } = vi.hoisted(() => ({
	pageState: {
		url: new URL('http://localhost/project/1/valuation'),
		params: { projectId: '1' as string | undefined },
		data: {}
	},
	remote: {
		getValuationAreas: vi.fn(),
		getValuationRateCount: vi.fn(),
		calculateValuation: vi.fn()
	}
}));

vi.mock('$lib/remote/valuation/valuation.remote', () => remote);

vi.mock('$app/state', () => ({ page: pageState }));

const nav = vi.hoisted(() => ({
	callbacks: [] as Array<(navigation: AfterNavigate) => void>
}));

vi.mock('$app/navigation', async () => {
	const { afterNavigateStub } = await import('$lib/test-utils/afterNavigateStub');
	return { goto: vi.fn(), afterNavigate: afterNavigateStub(nav.callbacks) };
});

vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('$lib/stores/store', async () => {
	const { writable } = await import('svelte/store');
	return { globalMapView: writable(false) };
});

vi.mock('./components/ValuationMap.svelte', async () => ({
	default: (await import('$lib/test-utils/mocks/MockMap.svelte')).default
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

const { globalMapView } = await import('$lib/stores/store');

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

/** A remote query stand-in that resolves to the valuation. */
function calculated() {
	return Promise.resolve(result);
}

/** Renders the page with an area named in the URL, so its valuation shows. */
async function renderCalculatedPage() {
	pageState.url = new URL('http://localhost/project/1/valuation?areas=area-1');
	render(Page);

	await screen.findByText('Tiefbau');
}

beforeEach(() => {
	pageState.url = new URL('http://localhost/project/1/valuation');
	pageState.params.projectId = '1';
	nav.callbacks.length = 0;
	globalMapView.set(false);
	remote.getValuationAreas.mockResolvedValue(areas);
	remote.getValuationRateCount.mockResolvedValue(2);
	remote.calculateValuation.mockReturnValue(calculated());
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('Valuation page', () => {
	test('should value the whole project when the URL names no areas', async () => {
		render(Page);

		expect(screen.getByRole('checkbox', { name: 'valuation_area_gesamt' })).toBeChecked();
		expect(await screen.findByRole('checkbox', { name: 'Nord' })).not.toBeChecked();
		expect(remote.calculateValuation).toHaveBeenCalledWith({ projectId: '1', areaUuids: [] });
		expect(screen.getByText('valuation_total')).toBeInTheDocument();
	});

	test('should value the project named in the URL', async () => {
		pageState.params.projectId = '5';

		render(Page);

		await screen.findByRole('checkbox', { name: 'Nord' });
		expect(remote.getValuationAreas).toHaveBeenCalledWith({ projectId: '5' });
		expect(remote.getValuationRateCount).toHaveBeenCalledWith({ projectId: '5' });
	});

	test('should value the areas named in the URL and list the priced cost rates', async () => {
		await renderCalculatedPage();

		expect(remote.calculateValuation).toHaveBeenCalledWith({
			projectId: '1',
			areaUuids: ['area-1']
		});
		expect(screen.getByRole('checkbox', { name: 'valuation_area_gesamt' })).not.toBeChecked();
		expect(await screen.findByRole('checkbox', { name: 'Nord' })).toBeChecked();
		expect(screen.getByText('valuation_total')).toBeInTheDocument();
	});

	test('should write a picked area to the URL as an adjustment', async () => {
		render(Page);

		await user.click(await screen.findByRole('checkbox', { name: 'Nord' }));

		expect(goto).toHaveBeenCalledWith(
			'/project/1/valuation?areas=area-1',
			expect.objectContaining({ replaceState: true })
		);
	});

	test('should project the result over the years following the base year in the URL', async () => {
		pageState.url = new URL('http://localhost/project/1/valuation?areas=area-1&baseYear=2030');
		render(Page);

		expect(await screen.findByRole('cell', { name: '2030' })).toBeInTheDocument();
		expect(screen.getByRole('cell', { name: '2051' })).toBeInTheDocument();
	});

	test('should write a changed base year to the URL', async () => {
		await renderCalculatedPage();

		await fireEvent.change(screen.getByLabelText('valuation_base_year'), {
			target: { value: '2030' }
		});

		expect(goto).toHaveBeenCalledWith(
			'/project/1/valuation?areas=area-1&baseYear=2030',
			expect.objectContaining({ replaceState: true })
		);
	});

	test('should show the backend message and a retry when the valuation fails', async () => {
		remote.calculateValuation.mockReturnValue(Promise.reject(httpError(400, 'No rates')));
		render(Page);

		expect(await screen.findByRole('alert')).toHaveTextContent('No rates');
		expect(screen.getByRole('button', { name: 'common_retry' })).toBeInTheDocument();
	});

	test('should drop the selection from the URL when the project changes', async () => {
		await renderCalculatedPage();

		pageState.params.projectId = '2';
		fireAfterNavigate(nav.callbacks, { projectId: '1' }, { projectId: '2' });

		await vi.waitFor(() =>
			expect(goto).toHaveBeenCalledWith(
				'/project/1/valuation',
				expect.objectContaining({ replaceState: true })
			)
		);
	});

	test('should keep the selection in the URL when the page loads', async () => {
		await renderCalculatedPage();

		expect(goto).not.toHaveBeenCalled();
	});

	test('should drop the selection from the URL when the global view is toggled', async () => {
		await renderCalculatedPage();
		expect(goto).not.toHaveBeenCalled();

		globalMapView.set(true);

		await vi.waitFor(() =>
			expect(goto).toHaveBeenCalledWith(
				'/project/1/valuation',
				expect.objectContaining({ replaceState: true })
			)
		);
		await vi.waitFor(() =>
			expect(remote.getValuationAreas).toHaveBeenLastCalledWith({ projectId: '' })
		);
	});
});
