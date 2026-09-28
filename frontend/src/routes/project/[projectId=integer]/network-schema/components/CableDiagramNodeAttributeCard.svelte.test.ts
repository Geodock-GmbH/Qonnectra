import type { NodeDrawerProps } from '$lib/types/attributeCardTypes';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';

import CableDiagramNodeAttributeCard from './CableDiagramNodeAttributeCard.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

const gotoMock = vi.fn();
vi.mock('$app/navigation', () => ({
	goto: (...args: unknown[]) => gotoMock(...args)
}));

vi.mock('$app/state', () => ({
	page: {
		route: { id: '/project/[projectId=integer]/network-schema' },
		url: new URL('http://localhost/project/7/network-schema'),
		data: {},
		params: { projectId: '7' }
	}
}));

// Node reads/writes run through remote-function modules; mock them so the
// component's calls are observable without a running server.
const getNodeDependencies = vi.fn();
const updateNode = vi.fn();
const deleteNode = vi.fn();

vi.mock('$lib/remote/network-schema/nodes.remote', () => ({
	getNodeDependencies: (...args: unknown[]) => getNodeDependencies(...args),
	updateNode: (...args: unknown[]) => updateNode(...args),
	deleteNode: (...args: unknown[]) => deleteNode(...args)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

const emptyDependencies = {
	loading: false,
	error: undefined,
	current: {
		cables: [],
		structures: [],
		children: [],
		childrenWithCables: [],
		hasChildren: false,
		hasCables: false,
		hasChildrenWithCables: false
	}
};

// `constructor: null` names the company field, so the literal is assignable
// to the card's record type instead of inheriting Object.prototype.constructor.
const node: NodeDrawerProps = {
	constructor: null,
	id: 'node-1',
	name: 'PoP-1',
	node_type: { id: 4 },
	status: { id: 2 },
	warranty: '2030',
	parent_node: { uuid: 'parent-1' }
};

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	getNodeDependencies.mockReturnValue(emptyDependencies);
	updateNode.mockResolvedValue({});
	deleteNode.mockResolvedValue(undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
	getNodeDependencies.mockReset();
	updateNode.mockReset();
	deleteNode.mockReset();
	gotoMock.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

/**
 * The real Skeleton combobox inside the funding status label.
 * @returns The label's scope and its combobox input.
 */
function fundingStatusField() {
	const label = screen.getByText('form_funding_status').closest('label') as HTMLLabelElement;
	return { label, input: within(label).getByRole('combobox') as HTMLInputElement };
}

describe('CableDiagramNodeAttributeCard', () => {
	test('should prefill the form from the drawer node', () => {
		render(CableDiagramNodeAttributeCard, { node });

		expect(screen.getByDisplayValue('PoP-1')).toBeInTheDocument();
	});

	test('should query dependencies for the current node', () => {
		render(CableDiagramNodeAttributeCard, { node });

		expect(getNodeDependencies).toHaveBeenCalledWith({ nodeId: 'node-1', projectId: '7' });
	});

	test('should submit the node update with attribute and parent ids', async () => {
		const onLabelUpdate = vi.fn();

		render(CableDiagramNodeAttributeCard, {
			node,
			onLabelUpdate
		} as unknown as Parameters<typeof render<typeof CableDiagramNodeAttributeCard>>[1]);

		const form = document.getElementById('node-form') as HTMLFormElement;
		form.requestSubmit();
		await vi.waitFor(() => expect(globalToaster.success).toHaveBeenCalled());

		expect(updateNode).toHaveBeenCalledWith(
			expect.objectContaining({
				nodeId: 'node-1',
				name: 'PoP-1',
				nodeTypeId: 4,
				statusId: 2,
				parentNodeId: 'parent-1'
			})
		);
		expect(onLabelUpdate).toHaveBeenCalledWith('PoP-1');
	});

	test('should prefill the funding status and submit a changed one', async () => {
		const user = userEvent.setup();
		render(CableDiagramNodeAttributeCard, { node: { ...node, funding_status: true } });

		const { label, input } = fundingStatusField();
		expect(input.value).toBe('common_yes');
		await user.click(within(label).getByRole('button', { name: 'Toggle suggestions' }));
		await user.click(await within(label).findByRole('option', { name: 'common_unknown' }));
		(document.getElementById('node-form') as HTMLFormElement).requestSubmit();

		await vi.waitFor(() =>
			expect(updateNode).toHaveBeenCalledWith(expect.objectContaining({ fundingStatus: null }))
		);
	});

	test('should toast an error when the update fails', async () => {
		updateNode.mockRejectedValue(new Error('nein'));

		render(CableDiagramNodeAttributeCard, { node });

		const form = document.getElementById('node-form') as HTMLFormElement;
		form.requestSubmit();

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalled());
		expect(globalToaster.success).not.toHaveBeenCalled();
	});
});
