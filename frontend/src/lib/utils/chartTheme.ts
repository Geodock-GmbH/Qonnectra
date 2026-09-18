import { createSubscriber } from 'svelte/reactivity';

/** Canvas-safe colors a chart draws with, resolved from the active theme. */
export interface ChartTheme {
	/** The theme's primary color, used for single-series charts. */
	series: string;
	/** Axis lines. */
	axisBorder: string;
	/** Axis ticks, titles and legend labels. */
	text: string;
	/** Separator between neighbouring segments (the page background). */
	segmentBorder: string;
	/**
	 * Shades of the primary color for multi-segment charts.
	 * @param count - Number of segments to color.
	 * @returns One color per segment; neighbours differ in lightness.
	 */
	shades: (count: number) => string[];
}

/** Primary shades ordered so neighbouring segments contrast. */
const SHADE_ORDER = [500, 800, 300, 950, 600, 200, 900, 400, 700, 100];

const FALLBACK_COLOR = '#6b7280';

const subscribeToThemeChange = createSubscriber((update) => {
	const observer = new MutationObserver(update);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-mode', 'data-theme']
	});
	return () => observer.disconnect();
});

/**
 * Resolves a CSS color expression (custom properties, `light-dark()`, oklch)
 * to an `rgb()` string. Chart.js derives hover colors with a parser that only
 * understands legacy color syntax, so theme colors are rasterized first.
 * @param host - Element whose cascade the expression is resolved in.
 * @param cssColor - Any CSS color expression.
 * @returns An `rgb()`/`rgba()` string, or a neutral gray when unresolvable.
 */
function resolveColor(host: HTMLElement, cssColor: string): string {
	const probe = document.createElement('span');
	probe.style.color = cssColor;
	host.appendChild(probe);
	const computed = getComputedStyle(probe).color;
	probe.remove();

	const pixel = document.createElement('canvas');
	pixel.width = pixel.height = 1;
	const ctx = pixel.getContext('2d', { willReadFrequently: true });
	if (!ctx || !computed) return FALLBACK_COLOR;

	ctx.fillStyle = computed;
	ctx.fillRect(0, 0, 1, 1);
	const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
	return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

/**
 * Reads the chart colors from the active Skeleton theme. Reactive: when called
 * inside an attachment, the attachment re-runs on light/dark or theme switches.
 * @param host - Element inside the themed document, e.g. the chart canvas' parent.
 * @returns The resolved theme colors.
 */
export function readChartTheme(host: HTMLElement): ChartTheme {
	subscribeToThemeChange();

	return {
		series: resolveColor(host, 'var(--color-primary-500)'),
		axisBorder: resolveColor(
			host,
			'light-dark(var(--color-surface-200), var(--color-surface-800))'
		),
		text: resolveColor(host, 'light-dark(var(--color-surface-900), var(--color-surface-100))'),
		segmentBorder: resolveColor(
			host,
			'light-dark(var(--color-root-bg-light), var(--color-root-bg-dark))'
		),
		shades: (count) =>
			Array.from({ length: count }, (_, i) =>
				resolveColor(host, `var(--color-primary-${SHADE_ORDER[i % SHADE_ORDER.length]})`)
			)
	};
}
