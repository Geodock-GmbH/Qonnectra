import { describe, expect, test, vi } from 'vitest';

import { fetchNodeDependencies } from './node-dependencies';

function okJson(data: unknown) {
	return { ok: true, json: () => Promise.resolve(data) } as unknown as Response;
}

const API = 'http://localhost:8000/';
const headers = { 'api-access-token': 'tok' };

describe('fetchNodeDependencies', () => {
	test('collects cables, structures, and children with cables', async () => {
		const fetchMock = vi.fn((url: string) => {
			if (url.includes('cable/at-node/node-1/')) {
				return Promise.resolve(okJson([{ uuid: 'cable-1' }]));
			}
			if (url.includes('node-structure/')) {
				return Promise.resolve(okJson([{ uuid: 'structure-1' }]));
			}
			if (url.includes('parent_node=node-1')) {
				return Promise.resolve(
					okJson({ features: [{ id: 'child-1', properties: { name: 'Kind 1' } }] })
				);
			}
			if (url.includes('cable/at-node/child-1/')) {
				return Promise.resolve(okJson([{ uuid: 'cable-2' }]));
			}
			return Promise.resolve(okJson([]));
		}) as unknown as typeof fetch;

		const result = await fetchNodeDependencies(fetchMock, headers, API, 'node-1', '7');

		expect(result).toEqual({
			cables: [{ uuid: 'cable-1' }],
			structures: [{ uuid: 'structure-1' }],
			children: [{ id: 'child-1', properties: { name: 'Kind 1' } }],
			childrenWithCables: [{ nodeId: 'child-1', nodeName: 'Kind 1', cableCount: 1 }],
			hasChildren: true,
			hasCables: true,
			hasChildrenWithCables: true
		});
	});

	test('skips child resolution when no projectId is given', async () => {
		const fetchMock = vi.fn(() => Promise.resolve(okJson([]))) as unknown as typeof fetch;

		const result = await fetchNodeDependencies(fetchMock, headers, API, 'node-1', undefined);

		expect(result.children).toEqual([]);
		expect(result.hasChildren).toBe(false);
		// Only the cables + structures requests fire, never a children lookup.
		expect((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
	});
});
