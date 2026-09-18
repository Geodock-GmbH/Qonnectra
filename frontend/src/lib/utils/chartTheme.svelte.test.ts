import { afterEach, describe, expect, test, vi } from 'vitest';

import { readChartTheme } from './chartTheme';

/**
 * Stubs the 1x1 canvas the theme rasterizes colors on. The pixel read back
 * encodes which color was painted, so the resolved value stays observable.
 */
function stubCanvas(pixel: number[]) {
	const painted: string[] = [];
	const imageData: ImageData = {
		data: new Uint8ClampedArray(pixel),
		width: 1,
		height: 1,
		colorSpace: 'srgb'
	};
	const context: Pick<CanvasRenderingContext2D, 'fillStyle' | 'fillRect' | 'getImageData'> = {
		set fillStyle(value: string) {
			painted.push(value);
		},
		fillRect: vi.fn(),
		getImageData: () => imageData
	};
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
		context as CanvasRenderingContext2D
	);
	return painted;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('readChartTheme', () => {
	test('should give single-series charts the translucent primary fill of the overview bars', () => {
		vi.spyOn(window, 'getComputedStyle').mockImplementation(
			(el) => ({ color: (el as HTMLElement).style.color }) as CSSStyleDeclaration
		);
		const painted = stubCanvas([16, 185, 129, 255]);

		const theme = readChartTheme(document.body);

		expect(painted[0]).toBe('var(--color-primary-500)');
		expect(theme.series).toBe('rgba(16, 185, 129, 0.2)');
	});

	test('should resolve axis and text colors as opaque rgb', () => {
		stubCanvas([20, 30, 40, 255]);

		const theme = readChartTheme(document.body);

		expect(theme.text).toBe('rgb(20, 30, 40)');
		expect(theme.axisBorder).toBe('rgb(20, 30, 40)');
	});

	test('should tint segments in primary, starting at the series fill with contrasting neighbours', () => {
		stubCanvas([16, 185, 129, 255]);

		const shades = readChartTheme(document.body).shades(3);

		expect(shades).toEqual([
			'rgba(16, 185, 129, 0.2)',
			'rgba(16, 185, 129, 0.65)',
			'rgba(16, 185, 129, 0.35)'
		]);
	});

	test('should give every segment of a ten-part chart its own tint', () => {
		stubCanvas([16, 185, 129, 255]);

		const shades = readChartTheme(document.body).shades(10);

		expect(new Set(shades).size).toBe(10);
	});

	test('should fall back to a neutral gray when no canvas is available', () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

		expect(readChartTheme(document.body).series).toBe('#6b7280');
	});

	test('should leave no probe elements behind', () => {
		stubCanvas([0, 0, 0, 255]);
		const before = document.body.childElementCount;

		readChartTheme(document.body);

		expect(document.body.childElementCount).toBe(before);
	});
});
