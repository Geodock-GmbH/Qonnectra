import { describe, expect, test, vi } from 'vitest';

import { fetchCableSplices, fetchCableSplicesAtNode } from './cable-splices';

function okJson(data: unknown) {
	return { ok: true, json: () => Promise.resolve(data) } as unknown as Response;
}

const API = 'http://localhost:8000/';
const headers = { 'api-access-token': 'tok' };

describe('fetchCableSplices', () => {
	test('merges and dedupes splices from both cable sides', async () => {
		const fetchMock = vi.fn((url: string) => {
			if (url.includes('cable_a=')) {
				return Promise.resolve(okJson([{ uuid: 's-1' }, { uuid: 's-2' }]));
			}
			if (url.includes('cable_b=')) {
				// s-2 is shared across both sides and must be deduped.
				return Promise.resolve(okJson([{ uuid: 's-2' }, { uuid: 's-3' }]));
			}
			return Promise.resolve(okJson([]));
		}) as unknown as typeof fetch;

		const result = await fetchCableSplices(fetchMock, headers, API, 'cab-1');

		expect(result.map((s) => s.uuid).sort()).toEqual(['s-1', 's-2', 's-3']);
	});

	test('returns an empty list when neither side has splices', async () => {
		const fetchMock = vi.fn(() => Promise.resolve(okJson([]))) as unknown as typeof fetch;

		const result = await fetchCableSplices(fetchMock, headers, API, 'cab-1');

		expect(result).toEqual([]);
	});
});

describe('fetchCableSplicesAtNode', () => {
	test('filters both sides by the node and dedupes', async () => {
		const urls: string[] = [];
		const fetchMock = vi.fn((url: string) => {
			urls.push(url);
			if (url.includes('cable_a=')) {
				return Promise.resolve(okJson([{ uuid: 's-1' }]));
			}
			if (url.includes('cable_b=')) {
				return Promise.resolve(okJson([{ uuid: 's-1' }, { uuid: 's-2' }]));
			}
			return Promise.resolve(okJson([]));
		}) as unknown as typeof fetch;

		const result = await fetchCableSplicesAtNode(fetchMock, headers, API, 'cab-1', 'node-9');

		expect(result.map((s) => s.uuid).sort()).toEqual(['s-1', 's-2']);
		// Both requests carry the node filter.
		expect(urls.every((u) => u.includes('node_structure__uuid_node=node-9'))).toBe(true);
	});
});
