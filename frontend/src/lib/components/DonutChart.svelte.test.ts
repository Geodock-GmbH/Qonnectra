import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import DonutChart from './DonutChart.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		form_no_data_available: () => 'Keine Daten verfügbar'
	}
}));

describe('DonutChart', () => {
	test('should render the title', () => {
		render(DonutChart, { title: 'Knoten nach Typ', data: [] });

		expect(screen.getByText('Knoten nach Typ')).toBeInTheDocument();
	});

	test('should show a placeholder without data', () => {
		render(DonutChart, { title: 'Leer', data: [] });

		expect(screen.getByText('Keine Daten verfügbar')).toBeInTheDocument();
	});

	test('should show a placeholder when all values are zero', () => {
		render(DonutChart, {
			title: 'Nullwerte',
			data: [
				{ label: 'A', value: 0 },
				{ label: 'B', value: 0 }
			]
		});

		expect(screen.getByText('Keine Daten verfügbar')).toBeInTheDocument();
	});

	test('should render a canvas when data is present', () => {
		const { container } = render(DonutChart, {
			title: 'Mit Daten',
			data: [{ label: 'A', value: 5 }]
		});

		expect(container.querySelector('canvas')).not.toBeNull();
		expect(screen.queryByText('Keine Daten verfügbar')).not.toBeInTheDocument();
	});
});
