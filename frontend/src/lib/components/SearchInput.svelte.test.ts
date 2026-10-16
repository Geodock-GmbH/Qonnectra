import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import SearchInput from './SearchInput.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		common_search: () => 'Suchen'
	}
}));

/**
 * Stubs `matchMedia` so only the coarse-pointer query matches when asked.
 * @param coarse - Whether the device reports a touch (coarse) pointer.
 */
function stubPointer(coarse: boolean) {
	vi.stubGlobal(
		'matchMedia',
		vi.fn((query: string) => ({ matches: coarse && query === '(pointer: coarse)' }))
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

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

	test('should close the on-screen keyboard after searching on a touch device', async () => {
		stubPointer(true);
		const user = userEvent.setup();
		render(SearchInput);

		const input = screen.getByTestId('search-input');
		await user.type(input, 'Hauptstraße{Enter}');

		expect(input).not.toHaveFocus();
	});

	test('should keep the focus after searching with a mouse', async () => {
		stubPointer(false);
		const user = userEvent.setup();
		render(SearchInput);

		const input = screen.getByTestId('search-input');
		await user.type(input, 'Hauptstraße{Enter}');

		expect(input).toHaveFocus();
	});

	test('should let a keydown handler take over Enter', async () => {
		const user = userEvent.setup();
		const onSearch = vi.fn();
		const onkeydown = vi.fn((event: KeyboardEvent) => event.preventDefault());
		render(SearchInput, { onSearch, onkeydown });

		await user.type(screen.getByTestId('search-input'), 'a{Enter}');

		expect(onkeydown).toHaveBeenCalled();
		expect(onSearch).not.toHaveBeenCalled();
	});

	test('should pass combobox attributes through to the input', () => {
		render(SearchInput, {
			role: 'combobox',
			'aria-expanded': true,
			'aria-controls': 'results'
		});

		const input = screen.getByRole('combobox');
		expect(input).toHaveAttribute('aria-expanded', 'true');
		expect(input).toHaveAttribute('aria-controls', 'results');
	});
});
