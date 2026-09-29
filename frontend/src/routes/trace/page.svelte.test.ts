import { error } from '@sveltejs/kit';
import { goto } from '$app/navigation';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getCableDetails } from '$lib/remote/network-schema/cables.remote';
import { getFiberColors, getFibersForCable } from '$lib/remote/network-schema/fibers.remote';

import TracePage from './+page.svelte';

const searchTraceEntries = vi.fn();

vi.mock('$lib/remote/trace/trace-search.remote', () => ({
	searchTraceEntries: (...args: unknown[]) => searchTraceEntries(...args)
}));

// The landing reads its settings from the URL, so the page stub is reactive
// and the navigation stub moves it: a click on a tab re-renders the page.
vi.mock('$app/state', async () => {
	const { reactivePageStub } = await import('$lib/test-utils/reactivePageStub.svelte');
	return {
		page: reactivePageStub({
			url: 'http://localhost/trace',
			data: { projects: [{ value: '7', label: 'Ausbau Nord' }] }
		})
	};
});

vi.mock('$app/navigation', async () => {
	const { gotoStub } = await import('$lib/test-utils/reactivePageStub.svelte');
	const { page } = await import('$app/state');
	return { goto: gotoStub(page) };
});

const gotoMock = vi.mocked(goto);

const REPLACE = { keepFocus: true, noScroll: true, replaceState: true };
const PUSH = { keepFocus: true, noScroll: true, replaceState: false };

// The remembered project is the search's default on this global page.
vi.mock('$lib/context/rememberedProject.svelte', async (importOriginal) => {
	const original = await importOriginal<typeof import('$lib/context/rememberedProject.svelte')>();
	const remembered = new original.RememberedProject('7');
	return { ...original, getRememberedProject: () => remembered };
});

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const addressHit = {
	uuid: 'addr-1',
	id_address: 'ABC1234',
	street: 'Main St',
	housenumber: 12,
	house_number_suffix: 'a',
	zip_code: '10115',
	city: 'Berlin'
};

const cableHit = { uuid: 'cable-1', name: 'Cable 1', cable_type: { cable_type: '48F' } };

/**
 * Builds a Kit HttpError the way a remote function's `error()` call does.
 */
function httpError(status: number, message: string): unknown {
	try {
		error(status, message);
	} catch (e) {
		return e;
	}
	return null;
}

beforeEach(async () => {
	await goto('/trace');
	gotoMock.mockClear();
});

afterEach(() => {
	searchTraceEntries.mockReset();
	gotoMock.mockClear();
});

describe('trace search page', () => {
	test('should show the hint and not search below two characters', async () => {
		const user = userEvent.setup();
		render(TracePage);

		await user.type(screen.getByPlaceholderText('trace_search_address_placeholder'), 'M');
		await new Promise((resolve) => setTimeout(resolve, 400));

		expect(screen.getByText('trace_search_hint')).toBeInTheDocument();
		expect(searchTraceEntries).not.toHaveBeenCalled();
	});

	test('should search addresses of the selected project and open the clicked hit', async () => {
		const user = userEvent.setup();
		searchTraceEntries.mockResolvedValue([addressHit]);
		render(TracePage);

		await user.type(screen.getByPlaceholderText('trace_search_address_placeholder'), 'Main');
		await user.click(await screen.findByRole('button', { name: /Main St, 12a, 10115 Berlin/ }));

		expect(searchTraceEntries).toHaveBeenCalledWith({
			searchQuery: 'Main',
			type: 'address',
			projectId: '7'
		});
		expect(gotoMock).toHaveBeenCalledWith('/trace/address/addr-1');
	});

	test('should switch the tab in the URL and search its entity type', async () => {
		const user = userEvent.setup();
		searchTraceEntries.mockResolvedValue([]);
		render(TracePage);

		await user.click(screen.getByTitle('form_residential_units'));
		expect(gotoMock).toHaveBeenCalledWith('/trace?type=residential-unit', REPLACE);
		await user.type(await screen.findByPlaceholderText('trace_search_ru_placeholder'), 'RU-7');

		expect(await screen.findByText('common_no_results')).toBeInTheDocument();
		expect(searchTraceEntries).toHaveBeenCalledWith({
			searchQuery: 'RU-7',
			type: 'residential_unit',
			projectId: '7'
		});
	});

	test('should open on the tab the URL names', async () => {
		await goto('/trace?type=node');
		gotoMock.mockClear();
		render(TracePage);

		expect(screen.getByPlaceholderText('trace_search_node_placeholder')).toBeInTheDocument();
		expect(gotoMock).not.toHaveBeenCalled();
	});

	test('should search every project once the global search is ticked', async () => {
		const user = userEvent.setup();
		searchTraceEntries.mockResolvedValue([addressHit]);
		render(TracePage);

		await user.click(screen.getByLabelText('trace_search_global'));
		expect(gotoMock).toHaveBeenCalledWith('/trace?global=true', REPLACE);
		await user.type(screen.getByPlaceholderText('trace_search_address_placeholder'), 'Main');
		await screen.findByRole('button', { name: /Main St/ });

		expect(searchTraceEntries).toHaveBeenCalledWith({
			searchQuery: 'Main',
			type: 'address',
			projectId: ''
		});
	});

	test('should carry the geometry option into the trace URL', async () => {
		const user = userEvent.setup();
		searchTraceEntries.mockResolvedValue([addressHit]);
		render(TracePage);

		await user.click(screen.getByLabelText('trace_include_geometry'));
		expect(gotoMock).toHaveBeenCalledWith('/trace?include_geometry=true', REPLACE);
		await user.type(screen.getByPlaceholderText('trace_search_address_placeholder'), 'Main');
		await user.click(await screen.findByRole('button', { name: /Main St/ }));

		expect(gotoMock).toHaveBeenLastCalledWith(
			'/trace/address/addr-1?include_geometry=true&geometry_mode=segments'
		);
	});

	test('should carry the geometry options the URL names into the trace URL', async () => {
		const user = userEvent.setup();
		searchTraceEntries.mockResolvedValue([addressHit]);
		await goto('/trace?include_geometry=true&geometry_mode=merged&orient_geometry=true');
		render(TracePage);

		expect(screen.getByLabelText('trace_include_geometry')).toBeChecked();
		expect(screen.getByLabelText('trace_orient_geometry')).toBeChecked();

		await user.type(screen.getByPlaceholderText('trace_search_address_placeholder'), 'Main');
		await user.click(await screen.findByRole('button', { name: /Main St/ }));

		expect(gotoMock).toHaveBeenLastCalledWith(
			'/trace/address/addr-1?include_geometry=true&geometry_mode=merged&orient_geometry=true'
		);
	});

	test('should pick a fiber through its cable', async () => {
		const user = userEvent.setup();
		searchTraceEntries.mockResolvedValue([cableHit]);
		vi.mocked(getFibersForCable).mockResolvedValue([
			{
				uuid: 'fiber-1',
				bundle_number: 1,
				bundle_color: 'Rot',
				fiber_number_in_bundle: 1,
				fiber_number_absolute: 1,
				fiber_color: 'Rot'
			}
		]);
		vi.mocked(getFiberColors).mockResolvedValue([]);
		render(TracePage);

		await user.click(screen.getByTitle('form_fiber'));
		expect(gotoMock).toHaveBeenLastCalledWith('/trace?type=fiber', REPLACE);
		await user.type(await screen.findByPlaceholderText('trace_search_cable_placeholder'), 'Cable');
		await user.click(await screen.findByRole('button', { name: /Cable 1/ }));

		expect(searchTraceEntries).toHaveBeenCalledWith({
			searchQuery: 'Cable',
			type: 'cable',
			projectId: '7'
		});
		// Picking the cable is a place: back returns to the cable search.
		expect(gotoMock).toHaveBeenLastCalledWith('/trace?type=fiber&cable=cable-1', PUSH);
		expect(getFibersForCable).toHaveBeenCalledWith('cable-1');

		await user.click(await screen.findByRole('button', { name: 'action_trace' }));

		expect(gotoMock).toHaveBeenLastCalledWith('/trace/fiber/fiber-1');
	});

	test('should offer the fibers of the cable the URL names', async () => {
		vi.mocked(getCableDetails).mockResolvedValue({
			name: 'Cable 1',
			cable_type: { cable_type: '48F' }
		});
		vi.mocked(getFibersForCable).mockResolvedValue([
			{
				uuid: 'fiber-1',
				bundle_number: 1,
				bundle_color: 'Rot',
				fiber_number_in_bundle: 1,
				fiber_number_absolute: 1,
				fiber_color: 'Rot'
			}
		]);
		vi.mocked(getFiberColors).mockResolvedValue([]);
		await goto('/trace?type=fiber&cable=cable-1');
		render(TracePage);

		expect(await screen.findByText('Cable 1')).toBeInTheDocument();
		expect(screen.getByText('48F')).toBeInTheDocument();
		expect(await screen.findByRole('button', { name: 'action_trace' })).toBeInTheDocument();
		expect(getCableDetails).toHaveBeenCalledWith('cable-1');
		expect(getFibersForCable).toHaveBeenCalledWith('cable-1');
		expect(searchTraceEntries).not.toHaveBeenCalled();
	});

	test('should ignore a picked cable off the fiber tab', async () => {
		await goto('/trace?type=cable&cable=cable-1');
		render(TracePage);

		expect(screen.getByPlaceholderText('trace_search_cable_placeholder')).toBeInTheDocument();
		expect(getFibersForCable).not.toHaveBeenCalled();
	});

	test('should return to the cable search when the picked cable is dismissed', async () => {
		const user = userEvent.setup();
		searchTraceEntries.mockResolvedValue([cableHit]);
		vi.mocked(getFibersForCable).mockResolvedValue([]);
		render(TracePage);

		await user.click(screen.getByTitle('form_fiber'));
		await user.type(await screen.findByPlaceholderText('trace_search_cable_placeholder'), 'Cable');
		await user.click(await screen.findByRole('button', { name: /Cable 1/ }));
		expect(await screen.findByText('trace_no_fibers_in_cable')).toBeInTheDocument();

		await user.click(screen.getByTitle('action_change'));

		// Dismissing rewrites the entry, so back never re-picks the cable.
		expect(gotoMock).toHaveBeenLastCalledWith('/trace?type=fiber', REPLACE);
		expect(
			await screen.findByPlaceholderText('trace_search_cable_placeholder')
		).toBeInTheDocument();
	});

	test('should show the backend message when the search fails', async () => {
		const user = userEvent.setup();
		searchTraceEntries.mockRejectedValue(httpError(502, 'Search backend down'));
		render(TracePage);

		await user.type(screen.getByPlaceholderText('trace_search_address_placeholder'), 'Main');

		expect(await screen.findByRole('alert')).toHaveTextContent('Search backend down');
	});
});
