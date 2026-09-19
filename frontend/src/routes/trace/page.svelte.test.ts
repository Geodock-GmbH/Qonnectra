import { error } from '@sveltejs/kit';
import { goto } from '$app/navigation';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { selectedProject } from '$lib/stores/store';
import { getFiberColors, getFibersForCable } from '$lib/remote/network-schema/fibers.remote';

import TracePage from './+page.svelte';

const searchTraceEntries = vi.fn();

vi.mock('$lib/remote/trace/trace-search.remote', () => ({
	searchTraceEntries: (...args: unknown[]) => searchTraceEntries(...args)
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

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

beforeEach(() => {
	selectedProject.set('7');
});

afterEach(() => {
	searchTraceEntries.mockReset();
	vi.mocked(goto).mockReset();
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
		expect(goto).toHaveBeenCalledWith('/trace/address/addr-1');
	});

	test('should search the tab’s entity type', async () => {
		const user = userEvent.setup();
		searchTraceEntries.mockResolvedValue([]);
		render(TracePage);

		await user.click(screen.getByTitle('form_residential_units'));
		await user.type(screen.getByPlaceholderText('trace_search_ru_placeholder'), 'RU-7');

		expect(await screen.findByText('common_no_results')).toBeInTheDocument();
		expect(searchTraceEntries).toHaveBeenCalledWith({
			searchQuery: 'RU-7',
			type: 'residential_unit',
			projectId: '7'
		});
	});

	test('should search every project once the global search is ticked', async () => {
		const user = userEvent.setup();
		searchTraceEntries.mockResolvedValue([addressHit]);
		render(TracePage);

		await user.click(screen.getByLabelText('trace_search_global'));
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
		await user.type(screen.getByPlaceholderText('trace_search_address_placeholder'), 'Main');
		await user.click(await screen.findByRole('button', { name: /Main St/ }));

		expect(goto).toHaveBeenCalledWith(
			'/trace/address/addr-1?include_geometry=true&geometry_mode=segments'
		);
	});

	test('should pick a fiber through its cable', async () => {
		const user = userEvent.setup();
		searchTraceEntries.mockResolvedValue([cableHit]);
		vi.mocked(getFibersForCable).mockResolvedValue([
			{ uuid: 'fiber-1', bundle_number: 1, bundle_color: 'Rot', fiber_number_in_bundle: 1 }
		]);
		vi.mocked(getFiberColors).mockResolvedValue([]);
		render(TracePage);

		await user.click(screen.getByTitle('form_fiber'));
		await user.type(screen.getByPlaceholderText('trace_search_cable_placeholder'), 'Cable');
		await user.click(await screen.findByRole('button', { name: /Cable 1/ }));

		expect(searchTraceEntries).toHaveBeenCalledWith({
			searchQuery: 'Cable',
			type: 'cable',
			projectId: '7'
		});
		expect(goto).not.toHaveBeenCalled();
		expect(getFibersForCable).toHaveBeenCalledWith('cable-1');

		await user.click(await screen.findByRole('button', { name: 'action_trace' }));

		expect(goto).toHaveBeenCalledWith('/trace/fiber/fiber-1');
	});

	test('should return to the cable search when the picked cable is dismissed', async () => {
		const user = userEvent.setup();
		searchTraceEntries.mockResolvedValue([cableHit]);
		vi.mocked(getFibersForCable).mockResolvedValue([]);
		render(TracePage);

		await user.click(screen.getByTitle('form_fiber'));
		await user.type(screen.getByPlaceholderText('trace_search_cable_placeholder'), 'Cable');
		await user.click(await screen.findByRole('button', { name: /Cable 1/ }));
		expect(await screen.findByText('trace_no_fibers_in_cable')).toBeInTheDocument();

		await user.click(screen.getByTitle('action_change'));

		expect(screen.getByPlaceholderText('trace_search_cable_placeholder')).toBeInTheDocument();
	});

	test('should show the backend message when the search fails', async () => {
		const user = userEvent.setup();
		searchTraceEntries.mockRejectedValue(httpError(502, 'Search backend down'));
		render(TracePage);

		await user.type(screen.getByPlaceholderText('trace_search_address_placeholder'), 'Main');

		expect(await screen.findByRole('alert')).toHaveTextContent('Search backend down');
	});
});
