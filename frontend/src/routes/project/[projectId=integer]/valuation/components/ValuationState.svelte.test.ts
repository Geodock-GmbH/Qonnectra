import type { ValuationResult } from '$lib/remote/valuation/valuation-data';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { calculateValuation } from '$lib/remote/valuation/valuation.remote';

import { ValuationState } from './ValuationState.svelte';
import { defaultBaseYear, MAX_URL_AREAS } from './valuationRequest';

const { pageState, gotoMock } = vi.hoisted(() => ({
	pageState: { url: new URL('http://localhost/project/7/valuation'), params: { projectId: '7' } },
	gotoMock: vi.fn()
}));

vi.mock('$app/state', () => ({ page: pageState }));
vi.mock('$app/navigation', () => ({ goto: (...args: unknown[]) => gotoMock(...args) }));

vi.mock('$lib/remote/valuation/valuation.remote', () => ({
	calculateValuation: vi.fn()
}));

vi.mock('$lib/stores/store', async () => {
	const { writable } = await import('svelte/store');
	return { globalMapView: writable(false) };
});

const { globalMapView } = await import('$lib/stores/store');

const result: ValuationResult = {
	categories: [],
	total: 1000,
	costPerHouseConnection: null,
	costPerMeter: null
};

/** A remote query stand-in that resolved to the valuation. */
function queryOf(current: ValuationResult) {
	return Promise.resolve(current);
}

/** The last navigation's target and options. */
function lastGoto() {
	return gotoMock.mock.calls.at(-1);
}

describe('ValuationState', () => {
	let valuation: ValuationState;

	beforeEach(() => {
		pageState.url = new URL('http://localhost/project/7/valuation');
		gotoMock.mockReset();
		vi.mocked(calculateValuation).mockReset();
		vi.mocked(calculateValuation).mockReturnValue(queryOf(result) as never);
		globalMapView.set(false);
		valuation = new ValuationState();
	});

	test('should value the whole project with default inputs when the URL names nothing', () => {
		expect(valuation.wholeProject).toBe(true);
		expect(valuation.selectedAreaUuids.size).toBe(0);
		expect(valuation.selectionValid).toBe(true);
		expect(valuation.areaUuids).toEqual([]);
		expect(valuation.baseYear).toBe(defaultBaseYear());
		expect(valuation.annualCorrectionPercent).toBe(2.5);
		expect(valuation.query).not.toBeNull();
		expect(calculateValuation).toHaveBeenCalledWith({ projectId: '7', areaUuids: [] });
	});

	test('should value the areas the URL names', () => {
		pageState.url = new URL('http://localhost/project/7/valuation?areas=area-1,area-2');

		expect(valuation.wholeProject).toBe(false);
		expect(valuation.areaUuids).toEqual(['area-1', 'area-2']);
		expect(valuation.query).not.toBeNull();
		expect(calculateValuation).toHaveBeenCalledWith({
			projectId: '7',
			areaUuids: ['area-1', 'area-2']
		});
	});

	describe('toggleArea', () => {
		test('should write the selection to the URL as an adjustment', () => {
			valuation.toggleArea('area-1');

			expect(lastGoto()).toEqual([
				'/project/7/valuation?areas=area-1',
				{ keepFocus: true, noScroll: true, replaceState: true }
			]);
		});

		test('should add to and remove from the areas in the URL', () => {
			pageState.url = new URL('http://localhost/project/7/valuation?areas=area-1');

			valuation.toggleArea('area-2');
			expect(lastGoto()?.[0]).toBe('/project/7/valuation?areas=area-1%2Carea-2');

			valuation.toggleArea('area-1');
			expect(lastGoto()?.[0]).toBe('/project/7/valuation');
		});

		test('should keep a selection too long for a link on the page with a hint', () => {
			const many = Array.from({ length: MAX_URL_AREAS }, (_, i) => `area-${i}`);
			pageState.url = new URL(`http://localhost/project/7/valuation?areas=${many.join(',')}`);

			valuation.toggleArea('one-more');

			expect(gotoMock).not.toHaveBeenCalled();
			expect(valuation.selectionBeyondUrl).toBe(true);
			expect(valuation.selectedAreaUuids.size).toBe(MAX_URL_AREAS + 1);
			expect(valuation.areaUuids).toContain('one-more');
		});
	});

	describe('toggleWholeProject', () => {
		test('should enter area picking without touching the URL', () => {
			valuation.toggleWholeProject();

			expect(valuation.wholeProject).toBe(false);
			expect(valuation.selectionValid).toBe(false);
			expect(valuation.query).toBeNull();
			expect(gotoMock).not.toHaveBeenCalled();
		});

		test('should drop the selected areas from the URL when switching back to the whole project', () => {
			pageState.url = new URL('http://localhost/project/7/valuation?areas=area-1&baseYear=2030');

			valuation.toggleWholeProject();

			expect(lastGoto()?.[0]).toBe('/project/7/valuation?baseYear=2030');
		});
	});

	describe('projection inputs', () => {
		test('should write a changed base year and correction, never the defaults', () => {
			valuation.setBaseYear(2030);
			expect(lastGoto()?.[0]).toBe('/project/7/valuation?baseYear=2030');

			valuation.setAnnualCorrection(4);
			expect(lastGoto()?.[0]).toBe('/project/7/valuation?correction=4');

			pageState.url = new URL('http://localhost/project/7/valuation?baseYear=2030&correction=4');
			valuation.setBaseYear(defaultBaseYear());
			expect(lastGoto()?.[0]).toBe('/project/7/valuation?correction=4');
			valuation.setAnnualCorrection(undefined);
			expect(lastGoto()?.[0]).toBe('/project/7/valuation?baseYear=2030');
		});

		test('should read the inputs from the URL', () => {
			pageState.url = new URL('http://localhost/project/7/valuation?baseYear=2030&correction=4');

			expect(valuation.baseYear).toBe(2030);
			expect(valuation.annualCorrectionPercent).toBe(4);
		});
	});

	describe('reset', () => {
		test('should return to the whole project, keeping the projection inputs', async () => {
			pageState.url = new URL('http://localhost/project/7/valuation?areas=area-1&baseYear=2030');
			valuation.toggleWholeProject();

			await valuation.reset();

			expect(lastGoto()?.[0]).toBe('/project/7/valuation?baseYear=2030');
		});

		test('should not navigate when the URL names no areas', async () => {
			valuation.toggleWholeProject();

			await valuation.reset();

			expect(valuation.wholeProject).toBe(true);
			expect(gotoMock).not.toHaveBeenCalled();
		});
	});

	describe('projectionRowsFor', () => {
		test('should project the total from the base year in the URL', () => {
			pageState.url = new URL('http://localhost/project/7/valuation?baseYear=2025&correction=10');

			const rows = valuation.projectionRowsFor(result);

			expect(rows).toHaveLength(22);
			expect(rows[0]).toEqual({ year: 2025, netValue: 1000, increase: null });
			expect(rows[1].year).toBe(2026);
			expect(rows[1].netValue).toBeCloseTo(1100);
		});
	});

	describe('project scope', () => {
		test('should read the project from the route', () => {
			expect(valuation.projectId).toBe('7');
			expect(valuation.areaScope).toBe('7');
		});

		test('should list the areas of all projects in the global view', () => {
			globalMapView.set(true);

			expect(valuation.areaScope).toBe('');
			expect(valuation.projectId).toBe('7');
		});
	});
});
