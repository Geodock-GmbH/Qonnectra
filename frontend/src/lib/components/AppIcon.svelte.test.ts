import { render } from '@testing-library/svelte';
import { describe, expect, test } from 'vitest';

import AppIcon from './AppIcon.svelte';

describe('AppIcon', () => {
	test('should render a solid icon with default color and size', () => {
		const { container } = render(AppIcon);

		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute('style')).toContain('width: 3rem');
		expect(svg?.getAttribute('style')).toContain('fill: var(--color-primary-500)');
		expect(container.querySelector('linearGradient')).toBeNull();
	});

	test('should apply custom color and size', () => {
		const { container } = render(AppIcon, { color: '#ff0000', size: '1rem' });

		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('style')).toContain('width: 1rem');
		expect(svg?.getAttribute('style')).toContain('fill: #ff0000');
	});

	test('should render the gradient variant', () => {
		const { container } = render(AppIcon, { gradient: true });

		expect(container.querySelector('linearGradient')).not.toBeNull();
		expect(container.querySelector('path')?.getAttribute('fill')).toBe('url(#app-icon-gradient)');
	});
});
