import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import LoadingOverlay from './LoadingOverlay.svelte';

type Navigation = { to: { route: { id: string } } } | null;

const navigating = vi.hoisted(() => {
	let value: Navigation = null;
	const subscribers = new Set<(value: Navigation) => void>();
	return {
		set(next: Navigation) {
			value = next;
			subscribers.forEach((run) => run(value));
		},
		subscribe(run: (value: Navigation) => void) {
			subscribers.add(run);
			run(value);
			return () => subscribers.delete(run);
		}
	};
});

vi.mock('$app/stores', () => ({
	navigating
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		common_loading: () => 'Laden...',
		message_loading_network_schema: () => 'Netzschema wird geladen...',
		message_please_wait: () => 'Bitte warten'
	}
}));

describe('LoadingOverlay', () => {
	test('should render nothing while not navigating', () => {
		navigating.set(null);
		const { container } = render(LoadingOverlay);

		expect(container.querySelector('[role="status"]')).toBeNull();
	});

	test('should show a generic loading message during navigation', async () => {
		navigating.set({ to: { route: { id: '/map/[[projectId]]' } } });
		render(LoadingOverlay);

		expect(await screen.findByText('Laden...')).toBeInTheDocument();
		expect(screen.getByText('Bitte warten')).toBeInTheDocument();
	});

	test('should show the network schema message for schema routes', async () => {
		navigating.set({ to: { route: { id: '/network-schema/[[projectId]]' } } });
		render(LoadingOverlay);

		expect(await screen.findByText('Netzschema wird geladen...')).toBeInTheDocument();
	});
});
