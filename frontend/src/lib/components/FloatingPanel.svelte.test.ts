import { createRawSnippet } from 'svelte';
import { render, screen } from '@testing-library/svelte';
import { describe, expect, test } from 'vitest';

import FloatingPanel from './FloatingPanel.svelte';

const children = createRawSnippet(() => ({
	render: () => '<p>Panel-Inhalt</p>'
}));

describe('FloatingPanel', () => {
	test('should render title and content when open', async () => {
		render(FloatingPanel, { open: true, title: 'Grabenprofil', children });

		expect(await screen.findByText('Grabenprofil')).toBeInTheDocument();
		expect(screen.getByText('Panel-Inhalt')).toBeInTheDocument();
	});

	test('should render nothing while closed', () => {
		render(FloatingPanel, { open: false, title: 'Grabenprofil', children });

		expect(screen.queryByText('Grabenprofil')).not.toBeVisible();
	});

	test('should render a resize trigger only when resizable', async () => {
		const { container: resizableContainer } = render(FloatingPanel, {
			open: true,
			title: 'A',
			resizable: true,
			children
		});
		await screen.findAllByText('A');
		expect(document.querySelector('[data-part="resize-trigger"]')).not.toBeNull();
		resizableContainer.remove();
	});
});
