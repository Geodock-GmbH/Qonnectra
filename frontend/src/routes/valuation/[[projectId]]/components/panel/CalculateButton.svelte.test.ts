import '@testing-library/jest-dom/vitest';

import type { ValuationResult } from '$lib/remote/valuation/valuation-data';
import { error } from '@sveltejs/kit';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import ValuationContextFixture from '../ValuationContext.fixture.svelte';
import { ValuationState } from '../ValuationState.svelte';
import CalculateButton from './CalculateButton.svelte';

const getValuationRateCount = vi.fn();
const calculateValuation = vi.fn();
const toastError = vi.fn();

vi.mock('$lib/remote/valuation/valuation.remote', () => ({
	getValuationRateCount: (...args: unknown[]) => getValuationRateCount(...args),
	calculateValuation: (...args: unknown[]) => calculateValuation(...args)
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: { error: (...args: unknown[]) => toastError(...args) }
}));

vi.mock('$app/state', () => ({ page: { params: { projectId: '7' } } }));

vi.mock('$lib/stores/store', async () => {
	const { writable } = await import('svelte/store');
	return { selectedProject: writable('7'), globalMapView: writable(false) };
});

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

const { globalMapView } = await import('$lib/stores/store');

const user = userEvent.setup();

const result: ValuationResult = {
	categories: [{ name: 'Tiefbau', unit: 'per_meter', amount: 100, quantity: 10, totalPrice: 1000 }],
	total: 1000,
	costPerHouseConnection: null,
	costPerMeter: 100
};

function renderButton() {
	const valuation = new ValuationState();
	render(ValuationContextFixture, { props: { component: CalculateButton, valuation } });
	return valuation;
}

beforeEach(() => {
	globalMapView.set(false);
	getValuationRateCount.mockResolvedValue(3);
	calculateValuation.mockResolvedValue(result);
});

afterEach(() => {
	getValuationRateCount.mockReset();
	calculateValuation.mockReset();
	toastError.mockReset();
});

describe('CalculateButton', () => {
	test('should calculate the whole project and publish the result', async () => {
		const valuation = renderButton();

		await user.click(await screen.findByRole('button', { name: 'valuation_calculate' }));

		expect(calculateValuation).toHaveBeenCalledWith({ projectId: '7', areaUuids: [] });
		await vi.waitFor(() => expect(valuation.result).toEqual(result));
	});

	test('should restrict the calculation to the selected areas', async () => {
		const valuation = renderButton();
		valuation.toggleArea('area-1');
		valuation.toggleArea('area-2');

		await user.click(await screen.findByRole('button', { name: 'valuation_calculate' }));

		expect(calculateValuation).toHaveBeenCalledWith({
			projectId: '7',
			areaUuids: ['area-1', 'area-2']
		});
	});

	test('should be disabled with a hint while nothing is selected', async () => {
		const valuation = renderButton();
		const button = await screen.findByRole('button', { name: 'valuation_calculate' });

		valuation.toggleWholeProject();

		await vi.waitFor(() => expect(button).toBeDisabled());
		expect(screen.getByText('valuation_select_area_hint')).toBeInTheDocument();
	});

	test('should be disabled with a warning when no cost rates exist', async () => {
		getValuationRateCount.mockResolvedValue(0);

		renderButton();

		expect(await screen.findByText('valuation_no_rates')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'valuation_calculate' })).toBeDisabled();
		expect(getValuationRateCount).toHaveBeenCalledWith({ projectId: '7' });
	});

	test('should check the cost rates of the valued project in the global view too', async () => {
		globalMapView.set(true);

		renderButton();

		await screen.findByRole('button', { name: 'valuation_calculate' });
		expect(getValuationRateCount).toHaveBeenCalledWith({ projectId: '7' });
	});

	test('should drop a result that arrives after the page was reset', async () => {
		let finish: (value: ValuationResult) => void = () => {};
		calculateValuation.mockReturnValue(
			new Promise<ValuationResult>((resolve) => (finish = resolve))
		);
		const valuation = renderButton();

		await user.click(await screen.findByRole('button', { name: 'valuation_calculate' }));
		valuation.reset();
		finish(result);

		expect(await screen.findByRole('button', { name: 'valuation_calculate' })).toBeEnabled();
		expect(valuation.result).toBeNull();
	});

	test('should report a failed calculation and keep the previous result', async () => {
		calculateValuation.mockImplementation(async () =>
			error(400, 'project: A valid integer is required.')
		);
		const valuation = renderButton();
		valuation.result = result;

		await user.click(await screen.findByRole('button', { name: 'valuation_calculate' }));

		await vi.waitFor(() =>
			expect(toastError).toHaveBeenCalledWith({
				title: 'common_error',
				description: 'project: A valid integer is required.'
			})
		);
		expect(valuation.result).toEqual(result);
		expect(screen.getByRole('button', { name: 'valuation_calculate' })).toBeEnabled();
	});

	test('should show progress and ignore clicks while calculating', async () => {
		let finish: (value: ValuationResult) => void = () => {};
		calculateValuation.mockReturnValue(
			new Promise<ValuationResult>((resolve) => (finish = resolve))
		);
		renderButton();

		await user.click(await screen.findByRole('button', { name: 'valuation_calculate' }));

		const busy = await screen.findByRole('button', { name: 'valuation_calculating' });
		expect(busy).toBeDisabled();

		finish(result);
		expect(await screen.findByRole('button', { name: 'valuation_calculate' })).toBeEnabled();
		expect(calculateValuation).toHaveBeenCalledTimes(1);
	});
});
