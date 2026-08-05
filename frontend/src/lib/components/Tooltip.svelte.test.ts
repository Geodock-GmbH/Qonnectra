import { createRawSnippet } from 'svelte';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import Tooltip from './Tooltip.svelte';

const children = createRawSnippet(() => ({
	render: () => '<span data-testid="trigger-content">Hover me</span>'
}));

describe('Tooltip', () => {
	test('should render the trigger children', () => {
		render(Tooltip, { content: 'Hilfetext', children });

		expect(screen.getByTestId('trigger-content')).toHaveTextContent('Hover me');
	});

	test('should render the content text with the closed state before interaction', () => {
		render(Tooltip, { content: 'Hilfetext', children });

		const content = screen.getByText('Hilfetext');
		expect(content).toHaveAttribute('data-state', 'closed');
		expect(content).toHaveAttribute('hidden');
	});

	test('should open the tooltip content when the trigger is hovered', async () => {
		const user = userEvent.setup();
		render(Tooltip, { content: 'Hilfetext', delay: 0, children });

		await user.hover(screen.getByTestId('trigger-content'));

		await waitFor(() =>
			expect(screen.getByText('Hilfetext')).toHaveAttribute('data-state', 'open')
		);
	});
});
