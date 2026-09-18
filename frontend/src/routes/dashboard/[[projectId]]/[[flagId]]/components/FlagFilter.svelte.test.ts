import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import FlagFilter from './FlagFilter.svelte';

const gotoMock = vi.fn();

vi.mock('$app/navigation', () => ({
	goto: (...args: unknown[]) => gotoMock(...args)
}));

vi.mock('$app/paths', () => ({
	resolve: (route: string, params: Record<string, string> = {}) =>
		route.replace(/\/\[\[(\w+)\]\]/g, (_match, key: string) =>
			params[key] ? `/${params[key]}` : ''
		)
}));

vi.mock('$app/state', () => ({
	page: {
		data: {
			flags: [
				{ value: '3', label: 'Cluster Nord' },
				{ value: '4', label: 'Cluster Süd' }
			],
			flagsError: null
		}
	}
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

/**
 * Opens the flag list and picks the option with the given label.
 */
async function pickFlag(label: string) {
	const user = userEvent.setup();
	await user.click(screen.getByRole('button', { name: /toggle|open|show/i }));
	await user.click(await screen.findByRole('option', { name: label }));
}

beforeEach(() => {
	gotoMock.mockReset();
});

describe('FlagFilter', () => {
	test('should show all flags as selected when the URL has no flag', () => {
		render(FlagFilter, { projectId: '7', flagId: '' });

		expect(screen.getByRole('combobox')).toHaveValue('form_all_flags');
	});

	test('should show the flag from the URL as selected', () => {
		render(FlagFilter, { projectId: '7', flagId: '4' });

		expect(screen.getByRole('combobox')).toHaveValue('Cluster Süd');
	});

	test('should navigate to the flag-scoped dashboard when a flag is picked', async () => {
		render(FlagFilter, { projectId: '7', flagId: '' });

		await pickFlag('Cluster Nord');

		expect(gotoMock).toHaveBeenCalledWith('/dashboard/7/3', expect.anything());
	});

	test('should navigate back to the unscoped dashboard when all flags is picked', async () => {
		render(FlagFilter, { projectId: '7', flagId: '3' });

		await pickFlag('form_all_flags');

		expect(gotoMock).toHaveBeenCalledWith('/dashboard/7', expect.anything());
	});

	test('should be disabled without a project', () => {
		render(FlagFilter, { projectId: '', flagId: '' });

		expect(screen.getByRole('combobox')).toBeDisabled();
	});
});
