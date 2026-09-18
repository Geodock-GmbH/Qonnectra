import type { InquiryArea } from '$lib/remote/pipeline-records/inquiry-area-data';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

import InquiryActions from './InquiryActions.svelte';

const gotoMock = vi.fn();

vi.mock('$app/navigation', () => ({
	goto: (...args: unknown[]) => gotoMock(...args)
}));

const getInquiryAreas = vi.fn();

vi.mock('$lib/remote/pipeline-records/inquiry-areas.remote', () => ({
	getInquiryAreas: (...args: unknown[]) => getInquiryAreas(...args)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: { success: vi.fn(), error: vi.fn() }
}));

const AREA: InquiryArea = { uuid: 'area-1', name: 'North field', geometry: null };

function renderActions(areas: InquiryArea[]) {
	getInquiryAreas.mockResolvedValue(areas);
	return render(BoundaryFixture, {
		props: { component: InquiryActions, props: { recordUuid: 'rec-1' } }
	});
}

afterEach(() => {
	gotoMock.mockReset();
	getInquiryAreas.mockReset();
});

describe('InquiryActions', () => {
	test('should offer a new inquiry and no export while the record has no areas', async () => {
		renderActions([]);

		expect(await screen.findByRole('button', { name: 'action_new_inquiry' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'action_export_inquiry' })).toBeNull();
		expect(getInquiryAreas).toHaveBeenCalledWith('rec-1');
	});

	test('should offer editing and the export once the record has areas', async () => {
		renderActions([AREA]);

		expect(await screen.findByRole('button', { name: 'action_edit_inquiry' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'action_export_inquiry' })).toBeInTheDocument();
	});

	test('should open the inquiry page of the record', async () => {
		const user = userEvent.setup();
		renderActions([]);

		await user.click(await screen.findByRole('button', { name: 'action_new_inquiry' }));

		expect(gotoMock).toHaveBeenCalledWith('/pipeline-records/rec-1/inquiry');
	});

	test('should fail the boundary when the areas cannot be loaded', async () => {
		getInquiryAreas.mockRejectedValue(new Error('Failed to fetch inquiry areas'));
		render(BoundaryFixture, {
			props: { component: InquiryActions, props: { recordUuid: 'rec-1' } }
		});

		expect(await screen.findByTestId('boundary-failed')).toHaveTextContent(
			'Failed to fetch inquiry areas'
		);
	});
});
