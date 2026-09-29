import { describe, expect, test } from 'vitest';

import { traceOptionsFromUrl, traceRequestFromPage, traceRequestKey } from './traceOptions';

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
			signalSource: null,
			pathStart: null
		});
	});

	test('should read the end a fiber trace is read from', () => {
		expect(traceOptionsFromUrl('fiber', traceUrl('start=node-abc')).pathStart).toBe('node-abc');
	});

	test('should only read a fiber trace from one end', () => {
		expect(traceOptionsFromUrl('cable', traceUrl('start=node-abc')).pathStart).toBeNull();
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
			signalSource: 'node-abc',
			pathStart: null
		});
	});

	test('should leave the path start to the backend in signal mode', () => {
		const url = traceUrl('mode=signal&source=node-abc&start=node-def');

		expect(traceOptionsFromUrl('fiber', url).pathStart).toBeNull();
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

describe('traceRequestKey', () => {
	const url = 'http://localhost/trace/fiber/f-1?include_geometry=true&geometry_mode=merged';
	const params = { entryType: 'fiber', uuid: 'f-1' };

	test('should ignore URL deltas outside the request', () => {
		const plain = traceRequestFromPage(params, new URL(url));
		const withHash = traceRequestFromPage(params, new URL(`${url}&feature=x#map=1/2/3`));

		expect(traceRequestKey(plain!)).toBe(traceRequestKey(withHash!));
	});

	test('should change with every option that changes the trace', () => {
		const base = traceRequestFromPage(params, new URL(url))!;
		const variants = [
			traceRequestFromPage({ ...params, uuid: 'f-2' }, new URL(url)),
			traceRequestFromPage({ ...params, entryType: 'cable' }, new URL(url)),
			traceRequestFromPage(params, new URL(`${url}&orient_geometry=true`)),
			traceRequestFromPage(params, new URL(url.replace('merged', 'segments'))),
			traceRequestFromPage(params, new URL(`${url}&mode=signal`)),
			traceRequestFromPage(params, new URL(`${url}&mode=signal&source=n-1`)),
			traceRequestFromPage(params, new URL(`${url}&start=n-1`))
		];

		const keys = new Set(variants.map((request) => traceRequestKey(request!)));
		expect(keys.size).toBe(variants.length);
		expect(keys.has(traceRequestKey(base))).toBe(false);
	});
});
