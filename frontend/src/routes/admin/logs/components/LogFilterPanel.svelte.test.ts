import type { LogFilters } from '$lib/remote/admin/logs-data';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import LogFilterPanel from './LogFilterPanel.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => (params?: { count?: number }) =>
				params?.count !== undefined ? `${prop}:${params.count}` : `${prop}`
		}
	)
}));

const filters: LogFilters = {
	level: 'ERROR',
	source: '',
	search: '',
	dateFrom: '',
	dateTo: '',
	project: '',
	page: 3
};

function renderPanel(initial = filters) {
	const onApply = vi.fn();
	const onClear = vi.fn();
	const view = render(LogFilterPanel, {
		filters: initial,
		projectOptions: [{ value: '', label: 'All Projects' }],
		onApply,
		onClear
	});
	return { ...view, onApply, onClear };
}

describe('LogFilterPanel', () => {
	test('applies the edited draft on top of the current filters', async () => {
		const user = userEvent.setup();
		const { onApply } = renderPanel();

		await user.type(screen.getByLabelText('common_search'), 'timeout');
		await user.click(screen.getByRole('button', { name: 'action_apply_filters' }));

		expect(onApply).toHaveBeenCalledWith({ ...filters, search: 'timeout' });
	});

	test('pre-fills the inputs from the current filters', () => {
		renderPanel({ ...filters, search: 'existing', dateFrom: '2026-01-01T00:00' });

		expect(screen.getByLabelText('common_search')).toHaveValue('existing');
		expect(screen.getByLabelText('form_date_from')).toHaveValue('2026-01-01T00:00');
	});

	test('follows a changed filters prop', async () => {
		const { rerender } = renderPanel();

		await rerender({
			filters: { ...filters, search: 'from-url' },
			projectOptions: [],
			onApply: vi.fn(),
			onClear: vi.fn()
		});

		expect(screen.getByLabelText('common_search')).toHaveValue('from-url');
	});

	test('delegates clearing to the parent', async () => {
		const user = userEvent.setup();
		const { onClear } = renderPanel();

		await user.click(screen.getByRole('button', { name: 'action_clear_filters' }));

		expect(onClear).toHaveBeenCalledOnce();
	});
});
