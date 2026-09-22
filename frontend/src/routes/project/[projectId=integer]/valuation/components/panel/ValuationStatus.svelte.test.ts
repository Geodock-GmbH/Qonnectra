import '@testing-library/jest-dom/vitest';

import type { ValuationResult } from '$lib/remote/valuation/valuation-data';
import { render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import ValuationContextFixture from '../ValuationContext.fixture.svelte';
import { ValuationState } from '../ValuationState.svelte';
import ValuationStatus from './ValuationStatus.svelte';

const getValuationRateCount = vi.fn();
const calculateValuation = vi.fn();

vi.mock('$lib/remote/valuation/valuation.remote', () => ({
	getValuationRateCount: (...args: unknown[]) => getValuationRateCount(...args),
	calculateValuation: (...args: unknown[]) => calculateValuation(...args)
}));

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/project/7/valuation'), params: { projectId: '7' } }
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

vi.mock('$lib/stores/store', async () => {
	const { writable } = await import('svelte/store');
	return { globalMapView: writable(false) };
});

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

const { globalMapView } = await import('$lib/stores/store');

const result: ValuationResult = {
	categories: [{ name: 'Tiefbau', unit: 'per_meter', amount: 100, quantity: 10, totalPrice: 1000 }],
	total: 1000,
	costPerHouseConnection: null,
	costPerMeter: 100
};

/** A remote query stand-in that resolved to the valuation. */
function queryOf(current: ValuationResult) {
	return Promise.resolve(current);
}

function renderStatus() {
	const valuation = new ValuationState();
	render(ValuationContextFixture, { props: { component: ValuationStatus, valuation } });
	return valuation;
}

beforeEach(() => {
	globalMapView.set(false);
	getValuationRateCount.mockResolvedValue(3);
	calculateValuation.mockReturnValue(queryOf(result));
});

afterEach(() => {
	getValuationRateCount.mockReset();
	calculateValuation.mockReset();
});

describe('ValuationStatus', () => {
	test('should stay quiet while the valuation of the URL selection is available', async () => {
		renderStatus();

		await vi.waitFor(() => expect(getValuationRateCount).toHaveBeenCalledWith({ projectId: '7' }));
		expect(screen.queryByText('valuation_no_rates')).not.toBeInTheDocument();
		expect(screen.queryByText('valuation_select_area_hint')).not.toBeInTheDocument();
	});

	test('should hint while areas are being picked and none is selected yet', async () => {
		const valuation = renderStatus();
		await vi.waitFor(() => expect(getValuationRateCount).toHaveBeenCalled());

		valuation.toggleWholeProject();

		expect(await screen.findByText('valuation_select_area_hint')).toBeInTheDocument();
	});

	test('should warn when no cost rates exist', async () => {
		getValuationRateCount.mockResolvedValue(0);

		renderStatus();

		expect(await screen.findByText('valuation_no_rates')).toBeInTheDocument();
	});

	test('should check the cost rates of the valued project in the global view too', async () => {
		globalMapView.set(true);

		renderStatus();

		await vi.waitFor(() => expect(getValuationRateCount).toHaveBeenCalledWith({ projectId: '7' }));
	});
});
