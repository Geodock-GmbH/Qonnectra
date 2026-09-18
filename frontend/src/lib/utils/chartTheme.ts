import { createSubscriber } from 'svelte/reactivity';

/** Canvas-safe colors a chart draws with, resolved from the active theme. */
export interface ChartTheme {
	/** The translucent primary fill of the overview bars, used for single-series charts. */
	series: string;
	/** Axis lines. */
	axisBorder: string;
	/** Axis ticks, titles and legend labels. */
	text: string;
	/** Separator between neighbouring segments (the page background). */
	segmentBorder: string;
	/**
	 * Tints of the primary color for multi-segment charts.
	 * @param count - Number of segments to color.
	 * @returns One color per segment, the first matching `series`; neighbours differ in opacity.
	 */
	shades: (count: number) => string[];
}

/** Opacity of the overview bars (`bg-primary-500/20`). */
const SERIES_ALPHA = 0.2;

/** Primary opacities ordered so neighbouring segments contrast. */
const SHADE_ALPHAS = [SERIES_ALPHA, 0.65, 0.35, 0.9, 0.5, 0.1, 0.75, 0.28, 1, 0.42];

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
 * @param cssColor - Any opaque CSS color expression.
 * @param alpha - Opacity to apply to the resolved color.
 * @returns An `rgb()`/`rgba()` string, or a neutral gray when unresolvable.
 */
function resolveColor(host: HTMLElement, cssColor: string, alpha = 1): string {
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
	const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
	return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Reads the chart colors from the active Skeleton theme. Reactive: when called
 * inside an attachment, the attachment re-runs on light/dark or theme switches.
 * @param host - Element inside the themed document, e.g. the chart canvas' parent.
 * @returns The resolved theme colors.
 */
export function readChartTheme(host: HTMLElement): ChartTheme {
	subscribeToThemeChange();

	const primary = 'var(--color-primary-500)';

	return {
		series: resolveColor(host, primary, SERIES_ALPHA),
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
				resolveColor(host, primary, SHADE_ALPHAS[i % SHADE_ALPHAS.length])
			)
	};
}
