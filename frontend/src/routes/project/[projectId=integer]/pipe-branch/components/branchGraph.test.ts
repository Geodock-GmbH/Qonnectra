import type { BranchConnection } from '$lib/remote/pipe-branch/connection-data';
import type { TrenchesNearNodeTrench } from '$lib/types';
import { describe, expect, test } from 'vitest';

import {
	conduitKey,
	connectionPair,
	lockedConduitKeys,
	matchingMicroductPairs,
	preselectedKeys,
	toBranchNodes,
	toConnectionEdges
} from './branchGraph';
import { microduct, trenches } from './branchGraph.fixture';

const saved: BranchConnection = {
	uuid: 'conn-1',
	from: { microductUuid: 'm1', trenchUuid: 't1' },
	to: { microductUuid: 'm3', trenchUuid: 't2' }
};

describe('toBranchNodes', () => {
	test('should place one node per conduit of every trench', () => {
		const nodes = toBranchNodes(trenches);

		expect(nodes.map((node) => node.id)).toEqual([
			'trench-t1-conduit-c1',
			'trench-t2-conduit-c2',
			'trench-t2-conduit-c3'
		]);
		expect(nodes[0]).toMatchObject({
			type: 'pipeBranch',
			data: { trench: trenches[0], conduit: trenches[0].conduits[0], totalMicroducts: 2 }
		});
	});

	test('should spread the nodes evenly on a circle around the canvas centre', () => {
		const nodes = toBranchNodes(trenches);

		const distances = nodes.map(({ position }) =>
			Math.round(Math.hypot(position.x - 400, position.y - 300))
		);
		expect(distances).toEqual([800, 800, 800]);
		expect(new Set(nodes.map(({ position }) => `${position.x}:${position.y}`)).size).toBe(3);
	});

	test('should return no nodes without trenches', () => {
		expect(toBranchNodes([])).toEqual([]);
	});
});

describe('toConnectionEdges', () => {
	test('should draw a saved connection between the handles of both microducts', () => {
		const [edge] = toConnectionEdges([saved], trenches);

		expect(edge).toMatchObject({
			id: 'connection-conn-1',
			type: 'pipeBranchEdge',
			source: 'trench-t1-conduit-c1',
			target: 'trench-t2-conduit-c2',
			sourceHandle: 'conduit-c1-microduct-1-source',
			targetHandle: 'conduit-c2-microduct-1-target',
			data: {
				uuid: 'conn-1',
				sourceHandleData: { microductUuid: 'm1', microductNumber: 1, conduitName: 'Conduit 1' },
				targetHandleData: { microductUuid: 'm3', microductNumber: 1, conduitName: 'Conduit 2' }
			}
		});
	});

	test('should mark a connection that is still being saved', () => {
		const [edge] = toConnectionEdges([{ ...saved, uuid: null }], trenches);

		expect(edge.id).toBe('pending-m1-m3');
		expect(edge.data?.uuid).toBeNull();
	});

	test('should skip a connection whose conduit is not on the canvas', () => {
		const edges = toConnectionEdges([saved], [trenches[0]]);

		expect(edges).toEqual([]);
	});

	test('should not match a microduct through the wrong trench', () => {
		const misplaced = { ...saved, to: { microductUuid: 'm3', trenchUuid: 't1' } };

		expect(toConnectionEdges([misplaced], trenches)).toEqual([]);
	});
});

describe('connectionPair', () => {
	const nodes = toBranchNodes(trenches);

	test('should resolve the dragged handles to their microducts and trenches', () => {
		const pair = connectionPair(
			{
				source: 'trench-t1-conduit-c1',
				sourceHandle: 'conduit-c1-microduct-2-source',
				target: 'trench-t2-conduit-c2',
				targetHandle: 'conduit-c2-microduct-1-target'
			},
			nodes
		);

		expect(pair).toEqual({
			from: { microductUuid: 'm2', trenchUuid: 't1' },
			to: { microductUuid: 'm3', trenchUuid: 't2' }
		});
	});

	test('should resolve a conduit uuid that itself contains dashes', () => {
		const dashed: TrenchesNearNodeTrench[] = [
			{
				uuid: 't9',
				id_trench: 'T-9',
				conduits: [{ uuid: '0b1c-44de-a1', name: 'Dashed', microducts: [microduct('m9', 12)] }]
			}
		];

		const pair = connectionPair(
			{
				source: 'trench-t9-conduit-0b1c-44de-a1',
				sourceHandle: 'conduit-0b1c-44de-a1-microduct-12-source',
				target: 'trench-t1-conduit-c1',
				targetHandle: 'conduit-c1-microduct-1-target'
			},
			[...toBranchNodes(dashed), ...nodes]
		);

		expect(pair?.from).toEqual({ microductUuid: 'm9', trenchUuid: 't9' });
	});

	test.each([
		['an unknown node', 'trench-x-conduit-x', 'conduit-c1-microduct-1-source'],
		['a malformed handle', 'trench-t1-conduit-c1', 'handle-1'],
		['a missing handle', 'trench-t1-conduit-c1', null],
		['an unknown microduct number', 'trench-t1-conduit-c1', 'conduit-c1-microduct-9-source']
	])('should return null for %s', (_case, source, sourceHandle) => {
		const pair = connectionPair(
			{
				source,
				sourceHandle,
				target: 'trench-t2-conduit-c2',
				targetHandle: 'conduit-c2-microduct-1-target'
			},
			nodes
		);

		expect(pair).toBeNull();
	});
});

describe('matchingMicroductPairs', () => {
	const [first, second, third] = toBranchNodes(trenches);

	test('should pair the microducts that share a number', () => {
		expect(matchingMicroductPairs(first, second, [])).toEqual([
			{
				from: { microductUuid: 'm1', trenchUuid: 't1' },
				to: { microductUuid: 'm3', trenchUuid: 't2' }
			},
			{
				from: { microductUuid: 'm2', trenchUuid: 't1' },
				to: { microductUuid: 'm4', trenchUuid: 't2' }
			}
		]);
	});

	test('should leave out pairs that are already connected in either direction', () => {
		const reversed: BranchConnection = { uuid: 'conn-2', from: saved.to, to: saved.from };

		expect(matchingMicroductPairs(first, second, [reversed])).toEqual([
			{
				from: { microductUuid: 'm2', trenchUuid: 't1' },
				to: { microductUuid: 'm4', trenchUuid: 't2' }
			}
		]);
	});

	test('should find nothing when no numbers match', () => {
		expect(matchingMicroductPairs(first, third, [])).toEqual([]);
	});
});

describe('lockedConduitKeys', () => {
	test('should lock the conduits on both ends of every connection', () => {
		expect(lockedConduitKeys([saved], trenches)).toEqual([
			conduitKey('t1', 'c1'),
			conduitKey('t2', 'c2')
		]);
	});

	test('should list a conduit once however many connections it carries', () => {
		const second: BranchConnection = {
			uuid: 'conn-2',
			from: { microductUuid: 'm2', trenchUuid: 't1' },
			to: { microductUuid: 'm4', trenchUuid: 't2' }
		};

		expect(lockedConduitKeys([saved, second], trenches)).toHaveLength(2);
	});

	test('should ignore connections to trenches that are no longer nearby', () => {
		expect(lockedConduitKeys([saved], [trenches[1]])).toEqual([conduitKey('t2', 'c2')]);
	});
});

describe('preselectedKeys', () => {
	test('should select every conduit of the saved trenches plus the locked ones', () => {
		const keys = preselectedKeys(trenches, ['t2'], [conduitKey('t1', 'c1')]);

		expect(keys.sort()).toEqual(
			[conduitKey('t1', 'c1'), conduitKey('t2', 'c2'), conduitKey('t2', 'c3')].sort()
		);
	});

	test('should not duplicate a locked conduit of a saved trench', () => {
		const keys = preselectedKeys(trenches, ['t1'], [conduitKey('t1', 'c1')]);

		expect(keys).toEqual([conduitKey('t1', 'c1')]);
	});

	test('should select nothing for a node without saved trenches or connections', () => {
		expect(preselectedKeys(trenches, [], [])).toEqual([]);
	});
});
