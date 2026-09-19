import { describe, expect, test } from 'vitest';

import { traceOptionsFromUrl, traceRequestFromPage } from './traceOptions';

/**
 * Builds a trace page URL with the given query string.
 * @param search - Query string without the leading `?`.
 */
function traceUrl(search = ''): URL {
	return new URL(`http://localhost/trace/fiber/f-1?${search}`);
}

describe('traceOptionsFromUrl', () => {
	test('should default to a plain trace without geometry', () => {
		expect(traceOptionsFromUrl('fiber', traceUrl())).toEqual({
			mode: 'trace',
			includeGeometry: false,
			geometryMode: 'segments',
			orientGeometry: false,
			signalSource: null
		});
	});

	test('should read the geometry options', () => {
		const url = traceUrl('include_geometry=true&geometry_mode=merged&orient_geometry=true');

		expect(traceOptionsFromUrl('address', url)).toMatchObject({
			includeGeometry: true,
			geometryMode: 'merged',
			orientGeometry: true
		});
	});

	test('should fall back to segments for an unknown geometry mode', () => {
		const url = traceUrl('include_geometry=true&geometry_mode=spaghetti');

		expect(traceOptionsFromUrl('cable', url).geometryMode).toBe('segments');
	});

	test('should force routed geometry in signal mode', () => {
		const url = traceUrl('mode=signal&source=node-abc&geometry_mode=merged');

		expect(traceOptionsFromUrl('fiber', url)).toEqual({
			mode: 'signal',
			includeGeometry: true,
			geometryMode: 'routed',
			orientGeometry: false,
			signalSource: 'node-abc'
		});
	});

	test('should leave the signal source to the backend when the URL names none', () => {
		expect(traceOptionsFromUrl('fiber', traceUrl('mode=signal&source=')).signalSource).toBeNull();
	});

	test('should only analyse the signal of a fiber', () => {
		expect(traceOptionsFromUrl('cable', traceUrl('mode=signal&source=node-abc'))).toMatchObject({
			mode: 'trace',
			includeGeometry: false,
			signalSource: null
		});
	});
});

describe('traceRequestFromPage', () => {
	test('should read the entity and its options from a result page', () => {
		const request = traceRequestFromPage(
			{ entryType: 'residential-unit', uuid: 'ru-1' },
			traceUrl('include_geometry=true')
		);

		expect(request).toMatchObject({
			entryType: 'residential_unit',
			entryId: 'ru-1',
			options: { mode: 'trace', includeGeometry: true }
		});
	});

	test('should find no request on the search page', () => {
		expect(traceRequestFromPage({}, new URL('http://localhost/trace'))).toBeNull();
	});
});
