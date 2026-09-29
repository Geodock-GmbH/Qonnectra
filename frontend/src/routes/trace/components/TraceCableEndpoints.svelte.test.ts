import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import TraceCableEndpoints from './TraceCableEndpoints.svelte';

const traceFrom = vi.fn();

vi.mock('$lib/utils/traceUtils', () => ({
	traceFrom: (...args: unknown[]) => traceFrom(...args)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const address = {
	id: 'addr-1',
	street: 'Hauptstraße',
	housenumber: '5',
	suffix: 'a',
	zip_code: '12345',
	city: 'Kiel'
};

describe('TraceCableEndpoints', () => {
	test('should re-trace from a node when its endpoint is clicked', async () => {
		render(TraceCableEndpoints, {
			endpoints: {
				cable_name: 'K-01',
				start_node: { id: 'node-a', name: 'PoP' },
				end_node: { id: 'node-b', name: 'NVt' }
			},
			currentNodeId: 'node-a'
		});

		expect(screen.getByText('trace_cable_path: K-01')).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: 'NVt' }));

		expect(traceFrom).toHaveBeenCalledWith('node', 'node-b');
	});

	test('should highlight only the endpoint the trace is currently at', () => {
		render(TraceCableEndpoints, {
			endpoints: {
				start_node: { id: 'node-a', name: 'PoP' },
				end_node: { id: 'node-b', name: 'NVt' }
			},
			currentNodeId: 'node-b'
		});

		expect(screen.getByRole('button', { name: 'NVt' })).toHaveClass('text-primary-500');
		expect(screen.getByRole('button', { name: 'PoP' })).not.toHaveClass('text-primary-500');
	});

	test('should say when an endpoint is not set', () => {
		render(TraceCableEndpoints, {
			endpoints: { start_node: { id: 'node-a', name: 'PoP' } },
			currentNodeId: undefined
		});

		expect(screen.getByText('trace_end_not_set')).toBeInTheDocument();
	});

	test('should re-trace from an endpoint address when it is clicked', async () => {
		render(TraceCableEndpoints, {
			endpoints: {
				start_node: { id: 'node-a', name: 'PoP', address },
				end_node: { id: 'node-b', name: 'NVt' }
			},
			currentNodeId: undefined
		});

		await userEvent.click(screen.getByRole('button', { name: /Hauptstraße/ }));

		expect(traceFrom).toHaveBeenCalledWith('address', 'addr-1');
	});
});
