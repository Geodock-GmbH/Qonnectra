import '@testing-library/jest-dom/vitest';

import type { ValuationArea } from '$lib/remote/valuation/valuation-data';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import ValuationContextFixture from '../ValuationContext.fixture.svelte';
import { ValuationState } from '../ValuationState.svelte';
import AreaList from './AreaList.svelte';

const getValuationAreas = vi.fn();

vi.mock('$lib/remote/valuation/valuation.remote', () => ({
	getValuationAreas: (...args: unknown[]) => getValuationAreas(...args)
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

function area(uuid: string, name: string, areaType: string | null): ValuationArea {
	return { uuid, name, areaType, geometry: null };
}

const areas = [
	area('area-1', 'Nord', 'Cluster'),
	area('area-2', 'Süd', 'Cluster'),
	area('area-3', 'Gewerbe', null)
];

function renderList() {
	const valuation = new ValuationState();
	const show = vi.spyOn(valuation.highlight, 'show');
	render(ValuationContextFixture, { props: { component: AreaList, valuation } });
	return { valuation, show };
}

beforeEach(() => {
	globalMapView.set(false);
	getValuationAreas.mockResolvedValue(areas);
});

afterEach(() => {
	getValuationAreas.mockReset();
});

describe('AreaList', () => {
	test('should load the areas of the project and group them by type', async () => {
		renderList();

		expect(screen.getByTestId('boundary-pending')).toBeInTheDocument();
		expect(await screen.findByRole('button', { name: /Cluster/ })).toHaveTextContent('2');
		expect(screen.getByRole('button', { name: /valuation_no_area_type/ })).toHaveTextContent('1');
		expect(getValuationAreas).toHaveBeenCalledWith({ projectId: '7' });
	});

	test('should load the areas of all projects in the global view', async () => {
		globalMapView.set(true);

		renderList();

		await screen.findByRole('button', { name: /Cluster/ });
		expect(getValuationAreas).toHaveBeenCalledWith({ projectId: '' });
	});

	test('should say so when the project has no areas', async () => {
		getValuationAreas.mockResolvedValue([]);

		renderList();

		expect(await screen.findByText('valuation_no_areas')).toBeInTheDocument();
	});

	test('should surface a failed load through the boundary', async () => {
		getValuationAreas.mockRejectedValue(new Error('Failed to load areas'));

		renderList();

		expect(await screen.findByTestId('boundary-failed')).toHaveTextContent('Failed to load areas');
	});

	test('should select an area and outline it on the map', async () => {
		const { valuation, show } = renderList();

		await user.click(await screen.findByRole('checkbox', { name: 'Nord' }));

		expect(valuation.selectedAreaUuids.has('area-1')).toBe(true);
		expect(valuation.wholeProject).toBe(false);
		expect(screen.getByRole('checkbox', { name: 'Nord' })).toBeChecked();
		expect(show).toHaveBeenLastCalledWith([areas[0]]);
	});

	test('should follow a selection made on the map', async () => {
		const { valuation, show } = renderList();
		const checkbox = await screen.findByRole('checkbox', { name: 'Süd' });

		valuation.toggleArea('area-2');

		await vi.waitFor(() => expect(checkbox).toBeChecked());
		expect(show).toHaveBeenLastCalledWith([areas[1]]);
	});

	test('should drop the outlines when the whole project is valued again', async () => {
		const { valuation, show } = renderList();
		await user.click(await screen.findByRole('checkbox', { name: 'Nord' }));

		valuation.toggleWholeProject();

		await vi.waitFor(() => expect(show).toHaveBeenLastCalledWith([]));
		expect(screen.getByRole('checkbox', { name: 'Nord' })).not.toBeChecked();
	});

	test('should fold a group away and open it again', async () => {
		renderList();
		const group = await screen.findByRole('button', { name: /Cluster/ });

		await user.click(group);
		expect(screen.queryByRole('checkbox', { name: 'Nord' })).not.toBeInTheDocument();
		expect(group).toHaveAttribute('aria-expanded', 'false');

		await user.click(group);
		expect(screen.getByRole('checkbox', { name: 'Nord' })).toBeInTheDocument();
	});
});
