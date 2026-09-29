import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import TraceFiberDetails from './TraceFiberDetails.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

describe('TraceFiberDetails color chips', () => {
	test('should use dark text and an outline on a white bundle color so the chip stays readable', () => {
		render(TraceFiberDetails, {
			fiber: { bundle_color: 'weiss', bundle_color_hex: '#ffffff' }
		});

		const chip = screen.getByText('B: weiss');
		expect(chip).not.toHaveClass('text-white');
		expect(chip).toHaveClass('text-surface-950', 'ring-1');
	});

	test('should keep white text on a dark fiber color', () => {
		render(TraceFiberDetails, {
			fiber: { fiber_color: 'blau', fiber_color_hex: '#0000ff' }
		});

		const chip = screen.getByText('blau');
		expect(chip).toHaveClass('text-white');
		expect(chip).not.toHaveClass('ring-1');
	});
});
