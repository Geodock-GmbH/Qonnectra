import type { InquiryArea } from '$lib/remote/pipeline-records/inquiry-area-data';
import type { OverrideStub } from '$lib/test-utils/remote-stubs';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import {
	commandFailure,
	commandResult,
	httpError,
	queryResult
} from '$lib/test-utils/remote-stubs';

import InquiryAreaList from './InquiryAreaList.svelte';

const getInquiryAreas = vi.fn();
const renameInquiryArea = vi.fn();
const deleteInquiryArea = vi.fn();

vi.mock('$lib/remote/pipeline-records/inquiry-areas.remote', () => ({
	getInquiryAreas: (...args: unknown[]) => getInquiryAreas(...args),
	renameInquiryArea: (...args: unknown[]) => renameInquiryArea(...args),
	deleteInquiryArea: (...args: unknown[]) => deleteInquiryArea(...args)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: { success: vi.fn(), error: vi.fn() }
}));

const user = userEvent.setup();

const areas: InquiryArea[] = [
	{ uuid: 'area-1', name: 'North field', geometry: null },
	{ uuid: 'area-2', name: null, geometry: null }
];

function renderList(shown = areas) {
	return render(InquiryAreaList, { props: { recordUuid: 'rec-1', areas: shown } });
}

beforeEach(() => {
	getInquiryAreas.mockImplementation(() => queryResult(areas));
	renameInquiryArea.mockImplementation(() => commandResult(undefined));
	deleteInquiryArea.mockImplementation(() => commandResult(undefined));
});

afterEach(() => {
	getInquiryAreas.mockReset();
	renameInquiryArea.mockReset();
	deleteInquiryArea.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('InquiryAreaList', () => {
	test('should render nothing while the record has no areas', () => {
		renderList([]);

		expect(screen.queryByText('label_inquiry_areas')).toBeNull();
	});

	test('should show saved names and number the unnamed areas', () => {
		renderList();

		expect(screen.getByDisplayValue('North field')).toBeInTheDocument();
		expect(screen.getByDisplayValue('label_inquiry_polygon_default 2')).toBeInTheDocument();
	});

	test('should rename an area with the trimmed name and override the list at once', async () => {
		const updates = vi.fn();
		renameInquiryArea.mockImplementation(() => commandResult(undefined, updates));
		renderList();
		const input = screen.getByDisplayValue('North field');

		await user.clear(input);
		await user.type(input, '  South field  ');
		await user.tab();

		expect(renameInquiryArea).toHaveBeenCalledWith({
			recordUuid: 'rec-1',
			areaUuid: 'area-1',
			name: 'South field'
		});
		expect(getInquiryAreas).toHaveBeenCalledWith('rec-1');
		const [override] = updates.mock.calls[0] as [OverrideStub<InquiryArea[]>];
		expect(override.update(areas).map((area) => area.name)).toEqual(['South field', null]);
		await vi.waitFor(() => expect(globalToaster.success).toHaveBeenCalled());
	});

	test('should not rename when the name is unchanged or empty', async () => {
		renderList();
		const input = screen.getByDisplayValue('North field');

		await user.click(input);
		await user.tab();
		await user.clear(input);
		await user.tab();

		expect(renameInquiryArea).not.toHaveBeenCalled();
	});

	test('should show the backend message when the rename is rejected', async () => {
		renameInquiryArea.mockImplementation(() => commandFailure(httpError(400, 'Name too long.')));
		renderList();
		const input = screen.getByDisplayValue('North field');

		await user.clear(input);
		await user.type(input, 'South field');
		await user.tab();

		await vi.waitFor(() =>
			expect(globalToaster.error).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'Name too long.' })
			)
		);
		expect(globalToaster.success).not.toHaveBeenCalled();
	});

	test('should delete an area and override it out of the list at once', async () => {
		const updates = vi.fn();
		deleteInquiryArea.mockImplementation(() => commandResult(undefined, updates));
		renderList();

		await user.click(screen.getAllByRole('button', { name: 'common_delete' })[0]);

		expect(deleteInquiryArea).toHaveBeenCalledWith({ recordUuid: 'rec-1', areaUuid: 'area-1' });
		const [override] = updates.mock.calls[0] as [OverrideStub<InquiryArea[]>];
		expect(override.update(areas).map((area) => area.uuid)).toEqual(['area-2']);
		await vi.waitFor(() => expect(globalToaster.success).toHaveBeenCalled());
	});

	test('should show the backend message when the delete is rejected', async () => {
		deleteInquiryArea.mockImplementation(() => commandFailure(httpError(500, 'Delete failed.')));
		renderList();

		await user.click(screen.getAllByRole('button', { name: 'common_delete' })[0]);

		await vi.waitFor(() =>
			expect(globalToaster.error).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'Delete failed.' })
			)
		);
	});
});
