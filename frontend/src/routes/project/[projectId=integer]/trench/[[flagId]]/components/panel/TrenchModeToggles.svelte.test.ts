import '@testing-library/jest-dom/vitest';

import type { TrenchMapManagers } from '../trenchMapContext';
import { get } from 'svelte/store';
import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { routingMode, showLinkedTrenches } from '$lib/stores/store';

import { TrenchAssignmentState } from '../TrenchAssignmentState.svelte';
import TrenchContextFixture from '../TrenchContext.fixture.svelte';
import TrenchModeToggles from './TrenchModeToggles.svelte';

vi.mock('$lib/stores/store', async () => {
	const { writable } = await import('svelte/store');
	return {
		routingMode: writable(false),
		showLinkedTrenches: writable(false),
		selectedConduit: writable(undefined)
	};
});

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

/**
 * The hidden checkbox Skeleton's switch renders; it carries no accessible name.
 * Toggled with `fireEvent`, since the switch's blur handler builds a
 * `PointerEvent`, which jsdom does not provide.
 * @param name - The switch's `name`.
 */
function switchInput(name: string): HTMLInputElement {
	const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
	if (!input) throw new Error(`No switch named ${name}`);
	return input;
}

function renderToggles() {
	const assignment = new TrenchAssignmentState(
		{ selectFeature: vi.fn(), selectMultipleFeatures: vi.fn(), clearSelection: vi.fn() },
		'conduit-1'
	);
	const resetRoute = vi.spyOn(assignment, 'resetRoute');
	const setVisible = vi.spyOn(assignment.trenchHighlights, 'setVisible');
	render(TrenchContextFixture, {
		props: {
			component: TrenchModeToggles,
			assignment,
			managers: {} as TrenchMapManagers
		}
	});
	return { resetRoute, setVisible };
}

afterEach(() => {
	routingMode.set(false);
	showLinkedTrenches.set(false);
});

describe('TrenchModeToggles', () => {
	test('should reflect the stored modes', () => {
		routingMode.set(true);

		renderToggles();

		expect(switchInput('routing-mode')).toBeChecked();
		expect(switchInput('show-linked-trenches')).not.toBeChecked();
	});

	test('should switch routing mode on and drop a half-picked route', async () => {
		const { resetRoute } = renderToggles();

		await fireEvent.click(switchInput('routing-mode'));

		expect(get(routingMode)).toBe(true);
		expect(resetRoute).toHaveBeenCalledTimes(1);
	});

	test('should drop the route when routing mode is switched off again', async () => {
		routingMode.set(true);
		const { resetRoute } = renderToggles();

		await fireEvent.click(switchInput('routing-mode'));

		expect(get(routingMode)).toBe(false);
		expect(resetRoute).toHaveBeenCalledTimes(1);
	});

	test('should show and hide the linked trenches on the map', async () => {
		const { setVisible } = renderToggles();
		const toggle = switchInput('show-linked-trenches');

		await fireEvent.click(toggle);
		expect(get(showLinkedTrenches)).toBe(true);
		expect(setVisible).toHaveBeenLastCalledWith(true);

		await fireEvent.click(toggle);
		expect(get(showLinkedTrenches)).toBe(false);
		expect(setVisible).toHaveBeenLastCalledWith(false);
	});
});
