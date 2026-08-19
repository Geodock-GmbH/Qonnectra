import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import MessageBox from './MessageBox.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

describe('MessageBox', () => {
	test('should stay hidden until opened', async () => {
		const { component } = render(MessageBox, {
			heading: 'Achtung',
			message: 'Wirklich löschen?'
		});

		expect(screen.queryByText('Achtung')).not.toBeVisible();

		component.open();
		expect(await screen.findByText('Achtung')).toBeInTheDocument();
		expect(screen.getByText('Wirklich löschen?')).toBeInTheDocument();
	});

	test('should close via the close button', async () => {
		const user = userEvent.setup();
		const { component } = render(MessageBox, {
			heading: 'Achtung',
			message: 'Text'
		});
		component.open();
		await screen.findByText('Achtung');

		await user.click(screen.getByRole('button', { name: 'common_close' }));

		expect(screen.queryByText('Achtung')).not.toBeVisible();
	});

	test('should only render the accept button when requested', async () => {
		const { component } = render(MessageBox, {
			heading: 'Achtung',
			message: 'Text'
		});
		component.open();
		await screen.findByText('Achtung');

		expect(screen.queryByRole('button', { name: 'common_confirm' })).not.toBeInTheDocument();
	});

	test('should invoke onAccept and close when accepting', async () => {
		const user = userEvent.setup();
		const onAccept = vi.fn();
		const { component } = render(MessageBox, {
			heading: 'Achtung',
			message: 'Text',
			showAcceptButton: true,
			onAccept
		});
		component.open();
		await screen.findByText('Achtung');

		await user.click(screen.getByRole('button', { name: 'common_confirm' }));

		expect(onAccept).toHaveBeenCalledTimes(1);
		expect(screen.queryByText('Achtung')).not.toBeVisible();
	});
});
