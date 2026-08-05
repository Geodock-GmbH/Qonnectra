import { render, screen } from '@testing-library/svelte';
import { describe, expect, test } from 'vitest';

import MapHint from './MapHint.svelte';

describe('MapHint', () => {
	test('should show the hint message by default', () => {
		render(MapHint, { message: 'Klicken zum Zeichnen' });

		expect(screen.getByText('Klicken zum Zeichnen')).toBeInTheDocument();
	});

	test('should render nothing when not visible', () => {
		const { container } = render(MapHint, { visible: false, message: 'Unsichtbar' });

		expect(container.textContent).toBe('');
	});

	test('should append custom classes', () => {
		render(MapHint, { message: 'Hinweis', class: 'custom-class' });

		expect(screen.getByText('Hinweis').parentElement?.className).toContain('custom-class');
	});
});
