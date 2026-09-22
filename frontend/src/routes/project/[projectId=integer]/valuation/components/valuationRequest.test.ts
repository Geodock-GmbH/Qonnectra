import { describe, expect, test } from 'vitest';

import { defaultBaseYear, valuationRequestFromUrl } from './valuationRequest';

function url(search = ''): URL {
	return new URL(`http://localhost/project/5/valuation${search}`);
}

describe('valuationRequestFromUrl', () => {
	test('should read areas, base year and correction', () => {
		expect(valuationRequestFromUrl(url('?areas=a,b&baseYear=2024&correction=3.5'))).toEqual({
			areaUuids: ['a', 'b'],
			baseYear: 2024,
			correction: 3.5
		});
	});

	test('should value the whole project with defaults when the URL names nothing', () => {
		expect(valuationRequestFromUrl(url())).toEqual({
			areaUuids: [],
			baseYear: defaultBaseYear(),
			correction: 2.5
		});
	});

	test('should fall back to the defaults for malformed values', () => {
		expect(valuationRequestFromUrl(url('?baseYear=abc&correction=x'))).toEqual({
			areaUuids: [],
			baseYear: defaultBaseYear(),
			correction: 2.5
		});
	});

	test('should count a duplicated area once and drop blanks', () => {
		expect(valuationRequestFromUrl(url('?areas=a,,a,b')).areaUuids).toEqual(['a', 'b']);
	});
});
