import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import NavigationProgress, { NAVIGATION_FEEDBACK_DELAY_MS } from './NavigationProgress.svelte';

type Target = { route: { id: string | null } } | null;

const appState = vi.hoisted(() => ({
	navigating: { from: null as Target, to: null as Target }
}));

vi.mock('$app/state', () => ({
	navigating: appState.navigating
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		common_loading: () => 'Laden...',
		message_loading_network_schema: () => 'Netzschema wird geladen...'
	}
}));

/**
 * Puts the mocked `navigating` state into a navigation between two route ids;
 * `null` on both sides means idle.
 * @param from - Route id the navigation leaves.
 * @param to - Route id the navigation targets.
 */
function setNavigating(from: string | null, to: string | null) {
	appState.navigating.from = from === null ? null : { route: { id: from } };
	appState.navigating.to = to === null ? null : { route: { id: to } };
}

/**
 * The delay is a CSS `animation-delay` fed from the exported constant, so the
 * tests pin the constant on the element instead of faking timers.
 */
describe('NavigationProgress', () => {
	test('should render nothing while idle', () => {
		setNavigating(null, null);
		render(NavigationProgress);

		expect(screen.queryByRole('status')).toBeNull();
	});

	test('should render nothing for a same-route change', () => {
		setNavigating('/project/[projectId=integer]/conduit', '/project/[projectId=integer]/conduit');
		render(NavigationProgress);

		expect(screen.queryByRole('status')).toBeNull();
	});

	test('should render a delayed, non-blocking bar for a route change', () => {
		setNavigating(
			'/project/[projectId=integer]/dashboard/[[flagId]]',
			'/project/[projectId=integer]/map'
		);
		render(NavigationProgress);

		const status = screen.getByRole('status', { name: 'Laden...' });
		expect(status).toHaveClass('pointer-events-none');
		expect(status.style.getPropertyValue('--navigation-feedback-delay')).toBe(
			`${NAVIGATION_FEEDBACK_DELAY_MS}ms`
		);
		expect(screen.queryByText('Netzschema wird geladen...')).toBeNull();
	});

	test('should render for the first navigation after hydration', () => {
		setNavigating(null, '/project/[projectId=integer]/map');
		render(NavigationProgress);

		expect(screen.getByRole('status')).toBeInTheDocument();
	});

	test('should name the network schema load by its route id', () => {
		setNavigating(
			'/project/[projectId=integer]/map',
			'/project/[projectId=integer]/network-schema'
		);
		render(NavigationProgress);

		expect(screen.getByRole('status', { name: 'Netzschema wird geladen...' })).toBeInTheDocument();
		expect(screen.getByText('Netzschema wird geladen...')).toBeInTheDocument();
	});
});
