import { createRawSnippet } from 'svelte';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import MapContextMenu from './MapContextMenu.svelte';

/**
 * Zag's popper marks the floating menu with `pointer-events: none` because
 * jsdom reports zero-size rects, so its `hideWhenDetached` logic treats the
 * trigger as detached. Disable user-event's pointer-events guard so menu
 * items remain clickable in tests.
 */
function setupUser() {
	return userEvent.setup({ pointerEventsCheck: 0 });
}

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const children = createRawSnippet(() => ({
	render: () => '<div data-testid="map-surface">Karte</div>'
}));

function makeMeasureManager(overrides: Record<string, unknown> = {}) {
	return {
		isMeasuring: false,
		startMeasure: vi.fn(),
		stopMeasure: vi.fn(),
		...overrides
	};
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
	const surface = screen.getByTestId('map-surface');
	await user.pointer({ keys: '[MouseRight]', target: surface });
	await waitFor(() => expect(screen.getByText('action_measure_distance')).toBeVisible());
}

afterEach(() => {
	vi.clearAllMocks();
});

describe('MapContextMenu', () => {
	test('should render the trigger children', () => {
		render(MapContextMenu, { measureManager: makeMeasureManager(), children });

		expect(screen.getByTestId('map-surface')).toBeInTheDocument();
	});

	test('should offer distance and area measure items when idle', async () => {
		const user = setupUser();
		render(MapContextMenu, { measureManager: makeMeasureManager(), children });

		await openMenu(user);

		expect(screen.getByText('action_measure_distance')).toBeInTheDocument();
		expect(screen.getByText('action_measure_area')).toBeInTheDocument();
		expect(screen.queryByText('action_stop_measuring')).not.toBeInTheDocument();
	});

	test('should show the stop-measuring item while measuring', async () => {
		const user = setupUser();
		render(MapContextMenu, {
			measureManager: makeMeasureManager({ isMeasuring: true }),
			children
		});

		await openMenu(user);

		expect(screen.getByText('action_stop_measuring')).toBeInTheDocument();
	});

	test('should start a distance measurement when that item is selected', async () => {
		const user = setupUser();
		const measureManager = makeMeasureManager();
		render(MapContextMenu, { measureManager, children });

		await openMenu(user);
		await user.click(screen.getByText('action_measure_distance'));

		expect(measureManager.startMeasure).toHaveBeenCalledWith('distance');
	});

	test('should start an area measurement when that item is selected', async () => {
		const user = setupUser();
		const measureManager = makeMeasureManager();
		render(MapContextMenu, { measureManager, children });

		await openMenu(user);
		await user.click(screen.getByText('action_measure_area'));

		expect(measureManager.startMeasure).toHaveBeenCalledWith('area');
	});

	test('should stop measuring when the stop item is selected', async () => {
		const user = setupUser();
		const measureManager = makeMeasureManager({ isMeasuring: true });
		render(MapContextMenu, { measureManager, children });

		await openMenu(user);
		await user.click(screen.getByText('action_stop_measuring'));

		expect(measureManager.stopMeasure).toHaveBeenCalledTimes(1);
	});

	test('should hide the area item when the area action is disabled', async () => {
		const user = setupUser();
		render(MapContextMenu, {
			measureManager: makeMeasureManager(),
			actions: { measureDistance: true, measureArea: false },
			children
		});

		await openMenu(user);

		expect(screen.getByText('action_measure_distance')).toBeInTheDocument();
		expect(screen.queryByText('action_measure_area')).not.toBeInTheDocument();
	});
});
