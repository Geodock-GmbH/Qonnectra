import type { TrenchProfileConduit } from '$lib/remote/map/trench-data';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';
import { commandFailure, commandResult, httpError } from '$lib/test-utils/remote-stubs';

import TrenchProfilePanel from './TrenchProfilePanel.svelte';

const getTrenchProfile = vi.fn();
const saveTrenchProfilePosition = vi.fn();

vi.mock('$lib/remote/map/trenches.remote', () => ({
	getTrenchProfile: (...args: unknown[]) => getTrenchProfile(...args),
	saveTrenchProfilePosition: (...args: unknown[]) => saveTrenchProfilePosition(...args)
}));

vi.mock('@xyflow/svelte', async () => {
	const { default: SvelteFlow } = await import('./SvelteFlowStub.fixture.svelte');
	const { default: Empty } = await import('$lib/test-utils/mocks/Controls.svelte');
	return {
		SvelteFlow,
		Controls: Empty,
		ViewportPortal: Empty,
		NodeResizer: Empty,
		useSvelteFlow: () => ({ fitView: vi.fn() })
	};
});

vi.mock('@xyflow/svelte/dist/style.css', () => ({}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

vi.mock('$lib/utils/logToBackendClient', () => ({
	logToBackendClient: vi.fn().mockResolvedValue(undefined)
}));

const conduit: TrenchProfileConduit = {
	conduit_uuid: 'conduit-1',
	conduit_name: 'DA 50',
	conduit_type: 'Rohr',
	microducts: [],
	has_saved_position: true,
	canvas_x: 10,
	canvas_y: 20,
	canvas_width: 100,
	canvas_height: 60
};

const user = userEvent.setup();

function renderPanel() {
	return render(BoundaryFixture, {
		props: { component: TrenchProfilePanel, props: { trenchUuid: 'trench-1' } }
	});
}

beforeEach(() => {
	getTrenchProfile.mockResolvedValue([conduit]);
	saveTrenchProfilePosition.mockReturnValue(commandResult(undefined));
});

afterEach(() => {
	getTrenchProfile.mockReset();
	saveTrenchProfilePosition.mockReset();
	vi.mocked(globalToaster.error).mockClear();
});

describe('TrenchProfilePanel', () => {
	test('should draw the conduits of the trench', async () => {
		renderPanel();

		expect(await screen.findByText('DA 50')).toBeInTheDocument();
		expect(getTrenchProfile).toHaveBeenCalledWith('trench-1');
	});

	test('should say so when the trench holds no conduits', async () => {
		getTrenchProfile.mockResolvedValue([]);

		renderPanel();

		expect(await screen.findByText('message_no_conduits_found_in_trench')).toBeInTheDocument();
	});

	test('should save the new position after a conduit was dragged', async () => {
		renderPanel();

		await user.click(await screen.findByRole('button', { name: 'drag first node' }));

		expect(saveTrenchProfilePosition).toHaveBeenCalledExactlyOnceWith({
			trenchUuid: 'trench-1',
			conduitUuid: 'conduit-1',
			x: 30,
			y: 40,
			width: 90,
			height: 70
		});
	});

	test('should save the new size once a resize has finished', async () => {
		renderPanel();

		await user.click(await screen.findByRole('button', { name: 'resize first node' }));

		expect(saveTrenchProfilePosition).toHaveBeenCalledExactlyOnceWith({
			trenchUuid: 'trench-1',
			conduitUuid: 'conduit-1',
			x: 10,
			y: 20,
			width: 120,
			height: 110
		});
	});

	test('should not save when a drag ends without a conduit', async () => {
		renderPanel();

		await user.click(await screen.findByRole('button', { name: 'drag nothing' }));

		expect(saveTrenchProfilePosition).not.toHaveBeenCalled();
	});

	test('should toast the backend message when saving fails', async () => {
		saveTrenchProfilePosition.mockReturnValue(commandFailure(httpError(400, 'Position rejected')));
		renderPanel();

		await user.click(await screen.findByRole('button', { name: 'drag first node' }));

		await vi.waitFor(() =>
			expect(globalToaster.error).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'Position rejected' })
			)
		);
	});

	test('should surface a failed profile request', async () => {
		getTrenchProfile.mockRejectedValue(httpError(502, 'Profile unavailable'));

		renderPanel();

		expect(await screen.findByTestId('boundary-failed')).toBeInTheDocument();
	});
});
