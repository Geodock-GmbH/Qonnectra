import '@testing-library/jest-dom/vitest';

import type { TrenchMapManagers } from '../trenchMapContext';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { TrenchAssignmentState } from '../TrenchAssignmentState.svelte';
import TrenchContextFixture from '../TrenchContext.fixture.svelte';
import ConduitPicker from './ConduitPicker.svelte';

const getConduitOptions = vi.fn();

vi.mock('$lib/remote/trench/conduit-options.remote', () => ({
	getConduitOptions: (...args: unknown[]) => getConduitOptions(...args)
}));

vi.mock('$lib/stores/store', () => ({ selectedConduit: { set: vi.fn() } }));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

const user = userEvent.setup();

const options = [
	{ value: 'conduit-1', label: 'Rohr 1 (7x10)' },
	{ value: 'conduit-2', label: 'Rohr 2 (12x10)' }
];

/**
 * @param conduitUuid - Conduit the assignment starts with, if any.
 */
function renderPicker(conduitUuid?: string) {
	const assignment = new TrenchAssignmentState(
		{ selectFeature: vi.fn(), selectMultipleFeatures: vi.fn(), clearSelection: vi.fn() },
		conduitUuid
	);
	render(TrenchContextFixture, {
		props: {
			component: ConduitPicker,
			props: { projectId: '7', flagId: '2' },
			assignment,
			managers: {} as TrenchMapManagers
		}
	});
	return assignment;
}

beforeEach(() => {
	getConduitOptions.mockResolvedValue(options);
});

afterEach(() => {
	getConduitOptions.mockReset();
});

describe('ConduitPicker', () => {
	test('should load the conduits of the project and flag', async () => {
		renderPicker();

		expect(screen.getByTestId('boundary-pending')).toBeInTheDocument();
		expect(await screen.findByPlaceholderText('placeholder_select_conduit')).toBeInTheDocument();
		expect(getConduitOptions).toHaveBeenCalledWith({ projectId: '7', flagId: '2' });
	});

	test('should surface a failed load through the boundary', async () => {
		getConduitOptions.mockRejectedValue(new Error('Failed to fetch conduits'));

		renderPicker();

		expect(await screen.findByTestId('boundary-failed')).toHaveTextContent(
			'Failed to fetch conduits'
		);
	});

	test('should show the conduit the assignment already holds', async () => {
		renderPicker('conduit-2');

		expect(await screen.findByDisplayValue('Rohr 2 (12x10)')).toBeInTheDocument();
	});

	test('should hand a picked conduit to the assignment', async () => {
		const assignment = renderPicker();

		await user.click(await screen.findByPlaceholderText('placeholder_select_conduit'));
		await user.click(await screen.findByRole('option', { name: 'Rohr 2 (12x10)' }));

		expect(assignment.conduitUuid).toBe('conduit-2');
	});

	test('should offer nothing to pick when the flag has no conduits', async () => {
		getConduitOptions.mockResolvedValue([]);

		renderPicker();

		await vi.waitFor(() =>
			expect(screen.queryByTestId('boundary-pending')).not.toBeInTheDocument()
		);
		expect(screen.queryByPlaceholderText('placeholder_select_conduit')).not.toBeInTheDocument();
	});
});
