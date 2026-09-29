import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import VirtualCombobox from './VirtualCombobox.svelte';

const data = [
	{ value: 'a', label: 'Alpha' },
	{ value: 'b', label: 'Beta' }
];

/**
 * Places the combobox input at the given bottom edge; the fixed dropdown opens 4px below it.
 * @param bottom - Bottom edge of the input in viewport pixels.
 * @returns The spy on the input's measurement, to count re-measures.
 */
function placeInputAt(bottom: number) {
	return vi
		.spyOn(HTMLInputElement.prototype, 'getBoundingClientRect')
		.mockReturnValue({ bottom, left: 10, width: 200 } as DOMRect);
}

/**
 * @returns The dropdown panel that wraps the listbox.
 */
function dropdown() {
	return screen.getByRole('listbox').parentElement as HTMLElement;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('VirtualCombobox fixed dropdown', () => {
	test('follows the input while the page scrolls', async () => {
		const user = userEvent.setup();
		placeInputAt(100);
		render(VirtualCombobox, { props: { data } });

		await user.click(screen.getByRole('combobox'));
		expect(dropdown().style.top).toBe('104px');

		placeInputAt(300);
		window.dispatchEvent(new Event('scroll'));

		await vi.waitFor(() => expect(dropdown().style.top).toBe('304px'));
	});

	test('stops measuring the input once the dropdown is closed', async () => {
		const user = userEvent.setup();
		placeInputAt(100);
		render(VirtualCombobox, { props: { data } });
		await user.click(screen.getByRole('combobox'));
		await user.keyboard('{Escape}');
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

		const measure = placeInputAt(300);
		measure.mockClear();
		window.dispatchEvent(new Event('scroll'));
		window.dispatchEvent(new Event('resize'));
		await new Promise((resolve) => requestAnimationFrame(resolve));

		expect(measure).not.toHaveBeenCalled();
	});
});
