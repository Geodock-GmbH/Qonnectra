import type { ChartConfiguration } from 'chart.js';
import { vi } from 'vitest';

/** A chart constructed through the mocked `chart.js`. */
export interface ChartInstance {
	config: ChartConfiguration;
	destroy: ReturnType<typeof vi.fn>;
}

/**
 * Builds a `chart.js` module mock whose `Chart` records every constructed
 * instance, so tests can assert on the configuration a component draws with.
 * jsdom has no canvas, so the 2d context is stubbed for the chart to be built.
 * @param instances - Receives every chart the component constructs.
 */
export function chartJsMock(instances: ChartInstance[]) {
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
		{} as CanvasRenderingContext2D
	);

	class Chart implements ChartInstance {
		static register = vi.fn();
		destroy = vi.fn();
		constructor(
			_ctx: CanvasRenderingContext2D,
			public config: ChartConfiguration
		) {
			instances.push(this);
		}
	}

	return {
		Chart,
		ArcElement: {},
		BarController: {},
		BarElement: {},
		CategoryScale: {},
		DoughnutController: {},
		Legend: {},
		LinearScale: {},
		Tooltip: {}
	};
}

/** Fixed theme colors standing in for the resolved Skeleton theme. */
export const chartThemeStub = {
	series: 'rgba(16, 185, 129, 0.2)',
	axisBorder: 'rgb(200, 200, 200)',
	text: 'rgb(20, 20, 20)',
	segmentBorder: 'rgb(255, 255, 255)',
	shades: (count: number) => Array.from({ length: count }, (_, i) => `shade-${i}`)
};
