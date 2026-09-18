import type { ChartInstance } from '$lib/test-utils/chartJsMock';
import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import StackedBarChart from './StackedBarChart.svelte';

const charts = vi.hoisted((): ChartInstance[] => []);

vi.mock('chart.js', async () => {
	const { chartJsMock } = await import('$lib/test-utils/chartJsMock');
	return chartJsMock(charts);
});

vi.mock('$lib/utils/chartTheme', async () => {
	const { chartThemeStub } = await import('$lib/test-utils/chartJsMock');
	return { readChartTheme: () => chartThemeStub };
});

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		form_no_data_available: () => 'Keine Daten verfügbar',
		common_length: () => 'Länge'
	}
}));

beforeEach(() => {
	charts.length = 0;
});

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
				datasets: [{ label: 'offen', data: [1.5] }]
			}
		});

		expect(container.querySelector('canvas')).not.toBeNull();
	});

	test('should color each dataset with a shade of the theme primary color', () => {
		render(StackedBarChart, {
			title: 'Mit Daten',
			data: {
				labels: ['verlegt'],
				datasets: [
					{ label: 'DA 50', data: [1.5] },
					{ label: 'DA 110', data: [0.5] }
				]
			}
		});

		expect(charts).toHaveLength(1);
		expect(charts[0].config.data.datasets.map((ds) => ds.backgroundColor)).toEqual([
			'shade-0',
			'shade-1'
		]);
		expect(charts[0].config.data.datasets.map((ds) => ds.label)).toEqual(['DA 50', 'DA 110']);
	});

	test('should destroy the chart on unmount', () => {
		const { unmount } = render(StackedBarChart, {
			title: 'T',
			data: { labels: ['verlegt'], datasets: [{ label: 'DA 50', data: [1.5] }] }
		});

		unmount();

		expect(charts[0].destroy).toHaveBeenCalledOnce();
	});
});
