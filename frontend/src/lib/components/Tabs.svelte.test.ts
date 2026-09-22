import { createRawSnippet } from 'svelte';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import Tabs from './Tabs.svelte';

const tabs = [
	{ value: 'general', label: 'Allgemein' },
	{ value: 'details', label: 'Details' }
];

const content = createRawSnippet(() => ({
	render: () => '<p>Tab-Inhalt</p>'
}));

describe('Tabs', () => {
	test('should render a trigger per tab and the content snippet', () => {
		render(Tabs, { tabs, children: content });

		expect(screen.getByRole('tab', { name: 'Allgemein' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'Details' })).toBeInTheDocument();
		expect(screen.getByText('Tab-Inhalt')).toBeInTheDocument();
	});

	test('should select the first tab by default', () => {
		render(Tabs, { tabs, children: content });

		expect(screen.getByRole('tab', { name: 'Allgemein' })).toHaveAttribute('aria-selected', 'true');
	});

	test('should notify when another tab is selected', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(Tabs, { tabs, children: content, onValueChange });

		await user.click(screen.getByRole('tab', { name: 'Details' }));

		expect(onValueChange).toHaveBeenCalledWith('details');
		expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
	});

	test('should keep the selected tab when the list changes but still offers it', async () => {
		const onValueChange = vi.fn();
		const { rerender } = render(Tabs, { tabs, value: 'details', children: content, onValueChange });

		await rerender({
			tabs: [
				{ value: 'new-first', label: 'Neu' },
				{ value: 'details', label: 'Details' }
			]
		});

		expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
		expect(onValueChange).not.toHaveBeenCalled();
	});

	test('should show the first tab when the selected one is not offered', async () => {
		const onValueChange = vi.fn();
		const { rerender } = render(Tabs, { tabs, value: 'details', children: content, onValueChange });

		await rerender({ tabs: [{ value: 'new-first', label: 'Neu' }] });

		expect(screen.getByRole('tab', { name: 'Neu' })).toHaveAttribute('aria-selected', 'true');
		expect(onValueChange).not.toHaveBeenCalled();
	});

	test('should show the first tab for a value the list does not offer', () => {
		render(Tabs, { tabs, value: 'nonsense', children: content });

		expect(screen.getByRole('tab', { name: 'Allgemein' })).toHaveAttribute('aria-selected', 'true');
	});
});
