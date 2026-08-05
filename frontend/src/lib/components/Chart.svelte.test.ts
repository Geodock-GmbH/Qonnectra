import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import Chart from './Chart.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		form_no_data_available: () => 'Keine Daten verfügbar'
	}
}));

describe('Chart', () => {
	test('should render the title', () => {
		render(Chart, { title: 'Gräben nach Status', data: [] });

		expect(screen.getByText('Gräben nach Status')).toBeInTheDocument();
	});

	test('should show a placeholder without data', () => {
		render(Chart, { title: 'Leer', data: [] });

		expect(screen.getByText('Keine Daten verfügbar')).toBeInTheDocument();
	});

	test('should show a placeholder when all values are zero', () => {
		render(Chart, {
			title: 'Nullwerte',
			data: [{ label: 'A', value: 0 }]
		});

		expect(screen.getByText('Keine Daten verfügbar')).toBeInTheDocument();
	});

	test('should render a canvas when data is present', () => {
		const { container } = render(Chart, {
			title: 'Mit Daten',
			data: [{ label: 'A', value: 12 }]
		});

		expect(container.querySelector('canvas')).not.toBeNull();
	});
});
