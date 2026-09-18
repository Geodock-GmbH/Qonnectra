import type { ComponentProps } from 'svelte';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import MicroductsDisplayTable from './MicroductsDisplayTable.svelte';

type MicroductsDisplayTableProps = ComponentProps<typeof MicroductsDisplayTable>;

vi.mock('$lib/components/GenericCombobox.svelte', () => import('./GenericCombobox.fixture.svelte'));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const microduct = {
	uuid: 'md-1',
	number: 3,
	color: 'rot',
	hex_code: '#ff0000',
	microduct_status: null,
	uuid_node: {
		properties: {
			uuid_address: {
				properties: {
					street: 'Hauptstraße',
					housenumber: '5',
					house_number_suffix: 'a',
					zip_code: '24211',
					city: 'Preetz'
				}
			}
		}
	},
	cable_connection: { name: 'K-Nord', type: 'LWL 96' }
};

describe('MicroductsDisplayTable', () => {
	test('should show a pulsing placeholder while loading', () => {
		const { container } = render(MicroductsDisplayTable, {
			loading: true,
			microducts: []
		} as unknown as MicroductsDisplayTableProps);

		expect(container.querySelector('.animate-pulse')).not.toBeNull();
	});

	test('should show the error message on failure', () => {
		render(MicroductsDisplayTable, {
			loading: false,
			error: 'Backend nicht erreichbar'
		} as unknown as MicroductsDisplayTableProps);

		expect(screen.getByText('Backend nicht erreichbar')).toBeInTheDocument();
	});

	test('should show an empty state without microducts', () => {
		render(MicroductsDisplayTable, {
			loading: false,
			microducts: []
		} as unknown as MicroductsDisplayTableProps);

		expect(screen.getByText('form_no_microducts_available')).toBeInTheDocument();
	});

	test('should render number, color, address, and cable per microduct', () => {
		render(MicroductsDisplayTable, {
			loading: false,
			microducts: [microduct]
		} as unknown as MicroductsDisplayTableProps);

		expect(screen.getByText('3')).toBeInTheDocument();
		expect(screen.getByText('rot')).toBeInTheDocument();
		expect(screen.getByText(/Hauptstraße/)).toBeInTheDocument();
		expect(screen.getByText(/K-Nord/)).toBeInTheDocument();
	});

	test('should show the status column with a healthy label when enabled', () => {
		render(MicroductsDisplayTable, {
			loading: false,
			microducts: [microduct],
			showStatus: true
		} as unknown as MicroductsDisplayTableProps);

		expect(screen.getByText('label_healthy')).toBeInTheDocument();
	});

	test('should strike through defective microducts and show their status', () => {
		render(MicroductsDisplayTable, {
			loading: false,
			microducts: [{ ...microduct, microduct_status: { id: 1, microduct_status: 'defekt' } }],
			showStatus: true
		} as unknown as MicroductsDisplayTableProps);

		expect(screen.getByText('defekt')).toBeInTheDocument();
		expect(screen.getByText('3').className).toContain('line-through');
	});

	test('should pass a numeric status id to onStatusChange, not the combobox string', async () => {
		const onStatusChange = vi.fn();
		render(MicroductsDisplayTable, {
			loading: false,
			microducts: [microduct],
			showStatus: true,
			editableStatus: true,
			statusOptions: [{ id: 1, microduct_status: 'defekt' }],
			onStatusChange
		} as unknown as MicroductsDisplayTableProps);

		await fireEvent.change(screen.getByTestId('combobox-stub'), { target: { value: '1' } });

		expect(onStatusChange).toHaveBeenCalledWith(microduct, 1);
		expect(onStatusChange.mock.calls[0][1]).toBe(1);
	});

	test('should pass null to onStatusChange for the healthy option', async () => {
		const onStatusChange = vi.fn();
		render(MicroductsDisplayTable, {
			loading: false,
			microducts: [{ ...microduct, microduct_status: { id: 1, microduct_status: 'defekt' } }],
			showStatus: true,
			editableStatus: true,
			statusOptions: [{ id: 1, microduct_status: 'defekt' }],
			onStatusChange
		} as unknown as MicroductsDisplayTableProps);

		await fireEvent.change(screen.getByTestId('combobox-stub'), { target: { value: 'healthy' } });

		expect(onStatusChange).toHaveBeenCalledWith(
			{ ...microduct, microduct_status: { id: 1, microduct_status: 'defekt' } },
			null
		);
	});
});
