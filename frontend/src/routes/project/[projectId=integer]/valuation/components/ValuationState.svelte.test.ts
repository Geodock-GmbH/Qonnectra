import type { ValuationResult } from '$lib/remote/valuation/valuation-data';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ValuationState } from './ValuationState.svelte';

const { pageParams } = vi.hoisted(() => ({
	pageParams: { projectId: undefined as string | undefined }
}));

vi.mock('$app/state', () => ({ page: { params: pageParams } }));

vi.mock('$lib/stores/store', async () => {
	const { writable } = await import('svelte/store');
	return { selectedProject: writable('1'), globalMapView: writable(false) };
});

const { selectedProject, globalMapView } = await import('$lib/stores/store');

const result: ValuationResult = {
	categories: [],
	total: 1000,
	costPerHouseConnection: null,
	costPerMeter: null
};

describe('ValuationState', () => {
	let valuation: ValuationState;

	beforeEach(() => {
		pageParams.projectId = undefined;
		selectedProject.set('1');
		globalMapView.set(false);
		valuation = new ValuationState();
	});

	test('should start covering the whole project without a result', () => {
		expect(valuation.wholeProject).toBe(true);
		expect(valuation.selectedAreaUuids.size).toBe(0);
		expect(valuation.result).toBeNull();
		expect(valuation.selectionValid).toBe(true);
		expect(valuation.areaUuids).toEqual([]);
	});

	describe('toggleArea', () => {
		test('should select an area and stop covering the whole project', () => {
			valuation.toggleArea('area-1');

			expect(valuation.selectedAreaUuids.has('area-1')).toBe(true);
			expect(valuation.wholeProject).toBe(false);
			expect(valuation.areaUuids).toEqual(['area-1']);
		});

		test('should deselect an area that is already selected', () => {
			valuation.toggleArea('area-1');
			valuation.toggleArea('area-1');

			expect(valuation.selectedAreaUuids.size).toBe(0);
		});

		test('should leave the selection invalid once the last area is deselected', () => {
			valuation.toggleArea('area-1');
			valuation.toggleArea('area-1');

			expect(valuation.wholeProject).toBe(false);
			expect(valuation.selectionValid).toBe(false);
		});
	});

	describe('toggleWholeProject', () => {
		test('should drop the selected areas when switching back to the whole project', () => {
			valuation.toggleArea('area-1');
			valuation.toggleWholeProject();

			expect(valuation.wholeProject).toBe(true);
			expect(valuation.selectedAreaUuids.size).toBe(0);
			expect(valuation.areaUuids).toEqual([]);
		});

		test('should require an area once the whole project is switched off', () => {
			valuation.toggleWholeProject();

			expect(valuation.wholeProject).toBe(false);
			expect(valuation.selectionValid).toBe(false);
		});
	});

	describe('reset', () => {
		test('should return to the whole project and drop the result', () => {
			valuation.toggleArea('area-1');
			valuation.result = result;

			valuation.reset();

			expect(valuation.wholeProject).toBe(true);
			expect(valuation.selectedAreaUuids.size).toBe(0);
			expect(valuation.result).toBeNull();
		});

		test('should let a running calculation tell that it is outdated', () => {
			const { resetCount } = valuation;

			valuation.reset();

			expect(valuation.resetCount).not.toBe(resetCount);
		});

		test('should keep the projection inputs', () => {
			valuation.baseYear = 2030;
			valuation.annualCorrectionPercent = 4;

			valuation.reset();

			expect(valuation.baseYear).toBe(2030);
			expect(valuation.annualCorrectionPercent).toBe(4);
		});
	});

	describe('projectionRows', () => {
		test('should be empty without a result', () => {
			expect(valuation.projectionRows).toEqual([]);
		});

		test('should project the total from the base year', () => {
			valuation.result = result;
			valuation.baseYear = 2025;
			valuation.annualCorrectionPercent = 10;

			const rows = valuation.projectionRows;

			expect(rows).toHaveLength(22);
			expect(rows[0]).toEqual({ year: 2025, netValue: 1000, increase: null });
			expect(rows[1].year).toBe(2026);
			expect(rows[1].netValue).toBeCloseTo(1100);
		});

		test('should follow a changed correction without a new calculation', () => {
			valuation.result = result;
			valuation.baseYear = 2025;
			valuation.annualCorrectionPercent = 10;
			valuation.annualCorrectionPercent = -50;

			expect(valuation.projectionRows[1].netValue).toBeCloseTo(500);
		});

		test('should be empty while an input is cleared', () => {
			valuation.result = result;

			valuation.annualCorrectionPercent = undefined;
			expect(valuation.projectionRows).toEqual([]);

			valuation.annualCorrectionPercent = 2.5;
			valuation.baseYear = undefined;
			expect(valuation.projectionRows).toEqual([]);
		});
	});

	describe('project scope', () => {
		test('should read the project from the route', () => {
			pageParams.projectId = '7';

			expect(valuation.projectId).toBe('7');
			expect(valuation.areaScope).toBe('7');
		});

		test('should fall back to the selected project when the route has none', () => {
			selectedProject.set('3');

			expect(valuation.projectId).toBe('3');
		});

		test('should list the areas of all projects in the global view', () => {
			pageParams.projectId = '7';
			globalMapView.set(true);

			expect(valuation.areaScope).toBe('');
			expect(valuation.projectId).toBe('7');
		});
	});
});
