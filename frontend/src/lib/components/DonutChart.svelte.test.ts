import type { ChartInstance } from '$lib/test-utils/chartJsMock';
import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import DonutChart from './DonutChart.svelte';

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

	test('should color the segments with shades of the theme primary color', () => {
		render(DonutChart, {
			title: 'Mit Daten',
			data: [
				{ label: 'A', value: 5 },
				{ label: 'B', value: 3 }
			]
		});

		expect(charts).toHaveLength(1);
		expect(charts[0].config.data.datasets[0].backgroundColor).toEqual(['shade-0', 'shade-1']);
		expect(charts[0].config.data.datasets[0].borderColor).toBe('rgb(255, 255, 255)');
	});

	test('should destroy the chart on unmount', () => {
		const { unmount } = render(DonutChart, { title: 'T', data: [{ label: 'A', value: 5 }] });

		unmount();

		expect(charts[0].destroy).toHaveBeenCalledOnce();
	});
});
