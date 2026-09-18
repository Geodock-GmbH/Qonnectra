import { error } from '@sveltejs/kit';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import AddressSearch from './AddressSearch.svelte';

const searchAddresses = vi.fn();

vi.mock('$lib/remote/post-compaction/address-search.remote', () => ({
	searchAddresses: (...args: unknown[]) => searchAddresses(...args)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const hit = {
	uuid: 'addr-1',
	id_address: 'ABC1234',
	street: 'Main St',
	housenumber: 12,
	house_number_suffix: 'a',
	zip_code: '10115',
	city: 'Berlin'
};

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

function renderSearch() {
	const onselect = vi.fn();
	render(AddressSearch, { props: { projectId: '7', onselect } });
	return { onselect, input: screen.getByPlaceholderText('pc_search_placeholder') };
}

afterEach(() => {
	searchAddresses.mockReset();
});

describe('AddressSearch', () => {
	test('should show the hint and not search below two characters', async () => {
		const user = userEvent.setup();
		const { input } = renderSearch();

		await user.type(input, 'M');
		await new Promise((resolve) => setTimeout(resolve, 400));

		expect(screen.getByText('trace_search_hint')).toBeInTheDocument();
		expect(searchAddresses).not.toHaveBeenCalled();
	});

	test('should search the project once typing pauses and list the hits', async () => {
		const user = userEvent.setup();
		searchAddresses.mockResolvedValue([hit]);
		const { input } = renderSearch();

		await user.type(input, ' Main ');

		expect(await screen.findByText('Main St, 12a, 10115 Berlin')).toBeInTheDocument();
		expect(screen.getByText('ABC1234')).toBeInTheDocument();
		expect(screen.queryByText('trace_search_hint')).not.toBeInTheDocument();
		expect(searchAddresses).toHaveBeenCalledTimes(1);
		expect(searchAddresses).toHaveBeenCalledWith({ searchQuery: 'Main', projectId: '7' });
	});

	test('should hand the uuid of the clicked hit to onselect', async () => {
		const user = userEvent.setup();
		searchAddresses.mockResolvedValue([hit]);
		const { input, onselect } = renderSearch();

		await user.type(input, 'Main');
		await user.click(await screen.findByRole('button', { name: /Main St/ }));

		expect(onselect).toHaveBeenCalledWith('addr-1');
	});

	test('should say so when nothing matches', async () => {
		const user = userEvent.setup();
		searchAddresses.mockResolvedValue([]);
		const { input } = renderSearch();

		await user.type(input, 'Nowhere');

		expect(await screen.findByText('common_no_results')).toBeInTheDocument();
	});

	test('should show the backend message when the search fails', async () => {
		const user = userEvent.setup();
		searchAddresses.mockRejectedValue(httpError(502, 'Search backend down'));
		const { input } = renderSearch();

		await user.type(input, 'Main');

		expect(await screen.findByRole('alert')).toHaveTextContent('Search backend down');
	});
});
