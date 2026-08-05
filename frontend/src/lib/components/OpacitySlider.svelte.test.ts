import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import OpacitySlider from './OpacitySlider.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		common_opacity: () => 'Deckkraft',
		tooltip_opacity_slider: () => 'Deckkraft einstellen'
	}
}));

describe('OpacitySlider', () => {
	test('should display the opacity as a percentage', () => {
		render(OpacitySlider, { opacity: 0.75 });

		expect(screen.getByText('75%')).toBeInTheDocument();
		expect(screen.getByText('Deckkraft')).toBeInTheDocument();
	});

	test('should display full opacity by default', () => {
		render(OpacitySlider);

		expect(screen.getByText('100%')).toBeInTheDocument();
	});

	test('should use the compact layout when requested', () => {
		render(OpacitySlider, { compact: true });

		const wrapper = screen.getByLabelText('Deckkraft einstellen');
		expect(wrapper.className).toBe('w-full');
	});
});
