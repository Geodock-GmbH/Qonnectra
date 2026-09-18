import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import GenericCombobox from './GenericCombobox.svelte';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));
vi.mock('$lib/stores/toaster', () => ({
	globalToaster: { error: vi.fn(), success: vi.fn() }
}));

const data = [
	{ value: 4, label: 'DA 50' },
	{ value: 2, label: 'DA 32' }
];

async function inputValue() {
	const input = (await screen.findAllByRole('combobox'))[0] as HTMLInputElement;
	return input.value;
}

describe('GenericCombobox preselection', () => {
	test('shows the label when a numeric option is preselected by its string id', async () => {
		render(GenericCombobox, { props: { data, value: ['4'] } });
		expect(await inputValue()).toBe('DA 50');
	});

	test('shows the label when a numeric option is preselected by its numeric id', async () => {
		render(GenericCombobox, { props: { data, value: [4] } });
		expect(await inputValue()).toBe('DA 50');
	});

	test('leaves the input empty when nothing is preselected', async () => {
		render(GenericCombobox, { props: { data, value: [] } });
		expect(await inputValue()).toBe('');
	});
});
