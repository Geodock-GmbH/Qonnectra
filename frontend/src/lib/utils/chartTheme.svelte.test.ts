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
	test('should resolve the series color from the theme primary color', () => {
		vi.spyOn(window, 'getComputedStyle').mockImplementation(
			(el) => ({ color: (el as HTMLElement).style.color }) as CSSStyleDeclaration
		);
		const painted = stubCanvas([16, 185, 129, 255]);

		const theme = readChartTheme(document.body);

		expect(painted[0]).toBe('var(--color-primary-500)');
		expect(theme.series).toBe('rgb(16, 185, 129)');
	});

	test('should keep the alpha channel of translucent colors', () => {
		stubCanvas([16, 185, 129, 51]);

		expect(readChartTheme(document.body).series).toBe('rgba(16, 185, 129, 0.200)');
	});

	test('should give neighbouring segments different primary shades', () => {
		vi.spyOn(window, 'getComputedStyle').mockImplementation(
			(el) => ({ color: (el as HTMLElement).style.color }) as CSSStyleDeclaration
		);
		const painted = stubCanvas([0, 0, 0, 255]);
		const theme = readChartTheme(document.body);
		painted.length = 0;

		expect(theme.shades(3)).toHaveLength(3);
		expect(painted).toEqual([
			'var(--color-primary-500)',
			'var(--color-primary-800)',
			'var(--color-primary-300)'
		]);
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
