import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { stringify } from 'devalue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalMapView, selectedProject } from '$lib/stores/store';
import { globalToaster } from '$lib/stores/toaster';

import SearchPanel from './SearchPanel.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

const pageStore = vi.hoisted(() => {
	const value = { data: { srid: 25832, proj4Def: '+proj=utm +zone=32' }, params: {} };
	return {
		subscribe(run: (value: unknown) => void) {
			run(value);
			return () => {};
		}
	};
});

vi.mock('$app/stores', () => ({
	page: pageStore
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

// jsdom does not implement the Web Animations API used by svelte transitions
Element.prototype.animate = function () {
	const animation = {
		onfinish: null as (() => void) | null,
		oncancel: null,
		cancel() {},
		finish() {},
		pause() {},
		play() {},
		finished: Promise.resolve()
	};
	queueMicrotask(() => animation.onfinish?.());
	return animation as unknown as Animation;
};

const fetchMock = vi.fn();

function searchResponse(results: Array<{ label: string; type: string; value: string }>) {
	return {
		ok: true,
		json: () => Promise.resolve({ type: 'success', data: stringify(results) })
	};
}

async function performSearch(query: string) {
	const user = userEvent.setup();
	await user.type(screen.getByTestId('search-input'), `${query}{Enter}`);
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	selectedProject.set('7');
	globalMapView.set(false);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
	vi.mocked(globalToaster.error).mockClear();
});

describe('SearchPanel', () => {
	test('should search features and render results with type badges', async () => {
		fetchMock.mockResolvedValue(
			searchResponse([
				{ label: 'Hauptstraße 5 (Adresse)', type: 'address', value: 'addr-1' },
				{ label: 'T-42 (Graben)', type: 'trench', value: 'trench-1' }
			])
		);
		render(SearchPanel);

		await performSearch('haupt');

		expect(await screen.findByText('Hauptstraße 5')).toBeInTheDocument();
		expect(screen.getByText('T-42')).toBeInTheDocument();
		expect(screen.getByText('form_address')).toBeInTheDocument();
		expect(screen.getByText('nav_trench')).toBeInTheDocument();

		const body = fetchMock.mock.calls[0][1].body as FormData;
		expect(fetchMock.mock.calls[0][0]).toBe('?/searchFeatures');
		expect(body.get('searchQuery')).toBe('haupt');
		expect(body.get('projectId')).toBe('7');
	});

	test('should search without a project in global map view', async () => {
		fetchMock.mockResolvedValue(searchResponse([]));
		globalMapView.set(true);
		render(SearchPanel);

		await performSearch('haupt');

		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
		const body = fetchMock.mock.calls[0][1].body as FormData;
		expect(body.get('projectId')).toBe('');
	});

	test('should not search for an empty query', async () => {
		render(SearchPanel);
		const user = userEvent.setup();

		await user.type(screen.getByTestId('search-input'), '{Enter}');
		await new Promise((resolve) => setTimeout(resolve, 350));

		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('should toast an error and notify the parent when the search fails', async () => {
		fetchMock.mockRejectedValue(new Error('offline'));
		const onSearchError = vi.fn();
		render(SearchPanel, { onSearchError });

		await performSearch('haupt');

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalled());
		expect(onSearchError).toHaveBeenCalled();
	});

	test('should show a filter input for large result sets and filter with it', async () => {
		const manyResults = [
			{ label: 'Zebrastreifen (Knoten)', type: 'node', value: 'node-zebra' },
			...Array.from({ length: 11 }, (_, index) => ({
				label: `Knoten-${index} (Knoten)`,
				type: 'node',
				value: `node-${index}`
			}))
		];
		fetchMock.mockResolvedValue(searchResponse(manyResults));
		const user = userEvent.setup();
		render(SearchPanel);

		await performSearch('knoten');
		await screen.findByText('Knoten-0');

		const filterInput = screen.getByPlaceholderText('common_filter');
		await user.type(filterInput, 'Zebra');

		expect(screen.getByText('Zebrastreifen')).toBeInTheDocument();
		expect(screen.queryByText('Knoten-0')).not.toBeInTheDocument();
	});

	test('should clear results via the exported clearSearch method', async () => {
		fetchMock.mockResolvedValue(
			searchResponse([{ label: 'PoP-1 (Knoten)', type: 'node', value: 'node-1' }])
		);
		const { component } = render(SearchPanel);
		await performSearch('pop');
		await screen.findByText('PoP-1');

		component.clearSearch();

		await vi.waitFor(() => expect(screen.queryByText('PoP-1')).not.toBeInTheDocument());
	});
});
