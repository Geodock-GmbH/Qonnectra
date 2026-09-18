import { describe, expect, test } from 'vitest';

import { toPipeBranchList } from './branch-data';

describe('toPipeBranchList', () => {
	test('should turn the minimal node payload into combobox options', () => {
		const result = toPipeBranchList({
			nodes: [
				{ name: 'Node A', uuid: 'uuid-a' },
				{ name: 'Node B', uuid: 'uuid-b' }
			],
			metadata: { pipe_branch_configured: true }
		});

		expect(result).toEqual({
			branches: [
				{ label: 'Node A', value: 'Node A', uuid: 'uuid-a' },
				{ label: 'Node B', value: 'Node B', uuid: 'uuid-b' }
			],
			configured: true
		});
	});

	test('should report an unconfigured project when the metadata is missing', () => {
		const result = toPipeBranchList({ nodes: [{ name: 'Node A', uuid: 'uuid-a' }] });

		expect(result.configured).toBe(false);
		expect(result.branches).toHaveLength(1);
	});

	test('should skip nodes without a name or uuid', () => {
		const result = toPipeBranchList({
			nodes: [{ name: 'Node A', uuid: 'uuid-a' }, { name: 'Nameless' }, { uuid: 'uuid-c' }, null]
		});

		expect(result.branches).toEqual([{ label: 'Node A', value: 'Node A', uuid: 'uuid-a' }]);
	});

	test.each([null, undefined, 'nodes', [], { nodes: 'none' }, { features: [] }])(
		'should return no branches for the unexpected payload %j',
		(payload) => {
			expect(toPipeBranchList(payload)).toEqual({ branches: [], configured: false });
		}
	);
});
