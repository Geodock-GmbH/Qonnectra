import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import StackedBarChart from './StackedBarChart.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		form_no_data_available: () => 'Keine Daten verfügbar'
	}
}));

describe('StackedBarChart', () => {
	test('should render the title', () => {
		render(StackedBarChart, { title: 'Länge nach Oberfläche' });

		expect(screen.getByText('Länge nach Oberfläche')).toBeInTheDocument();
	});

	test('should show a placeholder without datasets', () => {
		render(StackedBarChart, { title: 'Leer', data: { labels: [], datasets: [] } });

		expect(screen.getByText('Keine Daten verfügbar')).toBeInTheDocument();
	});

	test('should render a canvas when datasets are present', () => {
		const { container } = render(StackedBarChart, {
			title: 'Mit Daten',
			data: {
				labels: ['Asphalt'],
				datasets: [{ label: 'offen', data: [1.5], backgroundColor: '#0ea5e9' }]
			}
		});

		expect(container.querySelector('canvas')).not.toBeNull();
	});
});
