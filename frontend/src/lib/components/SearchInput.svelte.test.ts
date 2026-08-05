import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import SearchInput from './SearchInput.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		common_search: () => 'Suchen'
	}
}));

describe('SearchInput', () => {
	test('should render with the localized placeholder', () => {
		render(SearchInput);

		expect(screen.getByPlaceholderText('Suchen')).toBeInTheDocument();
	});

	test('should trigger the search on Enter', async () => {
		const user = userEvent.setup();
		const onSearch = vi.fn();
		render(SearchInput, { onSearch });

		const input = screen.getByTestId('search-input');
		await user.type(input, 'Hauptstraße{Enter}');

		expect(onSearch).toHaveBeenCalledTimes(1);
		expect(input).toHaveValue('Hauptstraße');
	});

	test('should not trigger the search on other keys', async () => {
		const user = userEvent.setup();
		const onSearch = vi.fn();
		render(SearchInput, { onSearch });

		await user.type(screen.getByTestId('search-input'), 'abc');

		expect(onSearch).not.toHaveBeenCalled();
	});

	test('should trigger the search via the button', async () => {
		const user = userEvent.setup();
		const onSearch = vi.fn();
		render(SearchInput, { onSearch });

		await user.click(screen.getByRole('button', { name: 'Suchen' }));

		expect(onSearch).toHaveBeenCalledTimes(1);
	});
});
