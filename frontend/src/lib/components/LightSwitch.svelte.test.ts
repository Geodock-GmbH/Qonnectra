import { get } from 'svelte/store';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { lightSwitchMode } from '$lib/stores/store';

import LightSwitch from './LightSwitch.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		tooltip_toggle_theme: () => 'Design wechseln'
	}
}));

beforeEach(() => {
	localStorage.clear();
	document.documentElement.removeAttribute('data-mode');
});

describe('LightSwitch', () => {
	test('should initialize with the saved light mode', async () => {
		render(LightSwitch);

		const toggle = screen.getByRole('switch', { name: 'Design wechseln' });
		expect(toggle).toHaveAttribute('aria-checked', 'false');
		expect(document.documentElement.getAttribute('data-mode')).toBe('light');
	});

	test('should initialize dark when dark mode was saved', async () => {
		localStorage.setItem('mode', 'dark');

		render(LightSwitch);

		expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
		expect(document.documentElement.getAttribute('data-mode')).toBe('dark');
	});

	test('should toggle to dark mode and persist the choice', async () => {
		const user = userEvent.setup();
		render(LightSwitch);

		await user.click(screen.getByRole('switch'));

		expect(document.documentElement.getAttribute('data-mode')).toBe('dark');
		expect(localStorage.getItem('mode')).toBe('dark');
		expect(get(lightSwitchMode)).toBe('dark');

		await user.click(screen.getByRole('switch'));
		expect(document.documentElement.getAttribute('data-mode')).toBe('light');
	});
});
