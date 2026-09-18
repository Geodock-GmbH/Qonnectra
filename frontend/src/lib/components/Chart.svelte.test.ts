import type { ChartInstance } from '$lib/test-utils/chartJsMock';
import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import Chart from './Chart.svelte';

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

	test('should draw the bars in the translucent primary fill of the overview', () => {
		render(Chart, { title: 'Mit Daten', data: [{ label: 'A', value: 12 }] });

		expect(charts).toHaveLength(1);
		expect(charts[0].config.data.datasets[0].backgroundColor).toBe('rgba(16, 185, 129, 0.2)');
		expect(charts[0].config.data.labels).toEqual(['A']);
	});

	test('should not draw a chart without data', () => {
		render(Chart, { title: 'Leer', data: [] });

		expect(charts).toHaveLength(0);
	});

	test('should redraw with the new values when the data changes', async () => {
		const { rerender } = render(Chart, { title: 'T', data: [{ label: 'A', value: 12 }] });

		await rerender({ data: [{ label: 'B', value: 3 }] });

		expect(charts).toHaveLength(2);
		expect(charts[0].destroy).toHaveBeenCalledOnce();
		expect(charts[1].config.data.labels).toEqual(['B']);
		expect(charts[1].destroy).not.toHaveBeenCalled();
	});

	test('should destroy the chart on unmount', () => {
		const { unmount } = render(Chart, { title: 'T', data: [{ label: 'A', value: 12 }] });

		unmount();

		expect(charts[0].destroy).toHaveBeenCalledOnce();
	});

	test('should label the axis with the unit unless an axis label is given', () => {
		render(Chart, { title: 'T', unit: 'm', data: [{ label: 'A', value: 12 }] });
		render(Chart, { title: 'T', axisLabel: 'Anzahl', data: [{ label: 'A', value: 12 }] });

		expect(charts[0].config.options?.scales?.x).toMatchObject({ title: { text: 'Länge (m)' } });
		expect(charts[1].config.options?.scales?.x).toMatchObject({ title: { text: 'Anzahl' } });
	});
});
