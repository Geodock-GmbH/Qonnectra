import '@testing-library/jest-dom/vitest';

import type { ValuationArea } from '$lib/remote/valuation/valuation-data';
import type { ReactivePage } from '$lib/test-utils/reactivePageStub.svelte';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import ValuationContextFixture from '../ValuationContext.fixture.svelte';
import { ValuationState } from '../ValuationState.svelte';
import AreaList from './AreaList.svelte';

const getValuationAreas = vi.fn();

vi.mock('$lib/remote/valuation/valuation.remote', () => ({
	getValuationAreas: (...args: unknown[]) => getValuationAreas(...args),
	calculateValuation: vi.fn(() => ({ current: undefined, loading: false }))
}));

const { gotoMock } = vi.hoisted(() => ({ gotoMock: vi.fn() }));

vi.mock('$app/state', async () => {
	const { reactivePageStub } = await import('$lib/test-utils/reactivePageStub.svelte');
	return {
		page: reactivePageStub({
			url: 'http://localhost/project/7/valuation',
			params: { projectId: '7' }
		})
	};
});
vi.mock('$app/navigation', async () => {
	const { replaceStateStub } = await import('$lib/test-utils/reactivePageStub.svelte');
	const { page } = await import('$app/state');
	return { goto: (...args: unknown[]) => gotoMock(...args), replaceState: replaceStateStub(page) };
});

vi.mock('$lib/stores/store', async () => {
	const { writable } = await import('svelte/store');
	return { globalMapView: writable(false) };
});

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

const { globalMapView } = await import('$lib/stores/store');
/** The mocked `page`, typed as the stub so tests can move its URL. */
const pageState = (await import('$app/state')).page as ReactivePage;

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
	pageState.url = new URL('http://localhost/project/7/valuation');
	pageState.state = {};
	gotoMock.mockReset();
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

	test('should write a picked area to the URL', async () => {
		renderList();

		await user.click(await screen.findByRole('checkbox', { name: 'Nord' }));

		expect(gotoMock).toHaveBeenCalledWith(
			'/project/7/valuation?areas=area-1',
			expect.objectContaining({ replaceState: true })
		);
	});

	test('should show and outline the areas the URL names', async () => {
		pageState.url = new URL('http://localhost/project/7/valuation?areas=area-2');
		const { show } = renderList();

		expect(await screen.findByRole('checkbox', { name: 'Süd' })).toBeChecked();
		expect(screen.getByRole('checkbox', { name: 'Nord' })).not.toBeChecked();
		expect(show).toHaveBeenLastCalledWith([areas[1]]);
	});

	test('should drop the areas from the URL when the whole project is valued again', async () => {
		pageState.url = new URL('http://localhost/project/7/valuation?areas=area-1');
		const { valuation } = renderList();
		await screen.findByRole('checkbox', { name: 'Nord' });

		valuation.toggleWholeProject();

		expect(gotoMock).toHaveBeenCalledWith(
			'/project/7/valuation',
			expect.objectContaining({ replaceState: true })
		);
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
