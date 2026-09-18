import type { PipelineRecord } from '$lib/remote/pipeline-records/record-data';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';
import { httpError } from '$lib/test-utils/remote-stubs';

import PipelineRecordEditor from './PipelineRecordEditor.svelte';

const gotoMock = vi.fn();

vi.mock('$app/navigation', () => ({
	goto: (...args: unknown[]) => gotoMock(...args)
}));

// Reads and writes run through the pipeline-record remote modules; mocking
// them makes the editor's calls observable without a server.
const getPipelineRecord = vi.fn();
const updatePipelineRecord = vi.fn();
const deletePipelineRecord = vi.fn();

vi.mock('$lib/remote/pipeline-records/records.remote', () => ({
	getPipelineRecord: (...args: unknown[]) => getPipelineRecord(...args),
	updatePipelineRecord: (...args: unknown[]) => updatePipelineRecord(...args),
	deletePipelineRecord: (...args: unknown[]) => deletePipelineRecord(...args)
}));

vi.mock('$lib/remote/pipeline-records/record-options.remote', () => ({
	getTypeOfWorkOptions: vi.fn().mockResolvedValue([{ value: 3, label: 'Excavation' }]),
	getRequestReasonOptions: vi.fn().mockResolvedValue([{ value: 7, label: 'Expansion' }])
}));

vi.mock('$lib/remote/pipeline-records/inquiry-areas.remote', () => ({
	getInquiryAreas: vi.fn().mockResolvedValue([])
}));

vi.mock('$lib/components/GenericCombobox.svelte', async () => {
	const { default: MockGenericCombobox } =
		await import('$lib/test-utils/mocks/MockGenericCombobox.svelte');
	return { default: MockGenericCombobox };
});

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => (params?: { count?: number }) =>
				params?.count !== undefined ? `${prop}:${params.count}` : `${prop}`
		}
	)
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

function makeRecord(overrides: Partial<PipelineRecord> = {}): PipelineRecord {
	return {
		uuid: 'rec-1',
		project_name: 'Fiber North',
		type_of_work: 'Excavation',
		request_reason: 'Expansion',
		organisation: 'Acme Telecom',
		name: 'Jane Doe',
		tel: '0123',
		mobile: '0170',
		...overrides
	};
}

function renderEditor(record = makeRecord()) {
	getPipelineRecord.mockResolvedValue(record);
	return render(BoundaryFixture, {
		props: { component: PipelineRecordEditor, props: { uuid: 'rec-1' } }
	});
}

beforeEach(() => {
	updatePipelineRecord.mockResolvedValue(makeRecord());
	deletePipelineRecord.mockResolvedValue(undefined);
});

afterEach(() => {
	gotoMock.mockReset();
	getPipelineRecord.mockReset();
	updatePipelineRecord.mockReset();
	deletePipelineRecord.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('PipelineRecordEditor', () => {
	test('should load the record and prefill the form with a read-only project', async () => {
		renderEditor();

		expect(await screen.findByDisplayValue('Acme Telecom')).toBeInTheDocument();
		expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
		expect(screen.getByDisplayValue('0123')).toBeInTheDocument();
		expect(screen.getByDisplayValue('0170')).toBeInTheDocument();
		expect(screen.getByTestId('active-project')).toHaveValue('Fiber North');
		expect(screen.getByTestId('active-project')).toHaveAttribute('readonly');
		expect(getPipelineRecord).toHaveBeenCalledWith('rec-1');
	});

	test('should fail the boundary when the record cannot be loaded', async () => {
		getPipelineRecord.mockRejectedValue(new Error('Not found.'));
		render(BoundaryFixture, {
			props: { component: PipelineRecordEditor, props: { uuid: 'rec-1' } }
		});

		expect(await screen.findByTestId('boundary-failed')).toHaveTextContent('Not found.');
	});

	test('should save the edited fields with the lookups resolved from the record', async () => {
		const user = userEvent.setup();
		renderEditor();
		const organisation = await screen.findByDisplayValue('Acme Telecom');

		await user.clear(organisation);
		await user.type(organisation, 'Globex');
		await user.click(screen.getAllByRole('button', { name: /common_save/ })[0]);

		expect(updatePipelineRecord).toHaveBeenCalledWith({
			uuid: 'rec-1',
			typeOfWorkId: 3,
			requestReasonId: 7,
			organisation: 'Globex',
			name: 'Jane Doe',
			tel: '0123',
			mobile: '0170'
		});
		await vi.waitFor(() => expect(globalToaster.success).toHaveBeenCalled());
	});

	test('should show the backend message when the save is rejected', async () => {
		const user = userEvent.setup();
		updatePipelineRecord.mockRejectedValue(httpError(400, 'tel: Too long.'));
		renderEditor();
		await screen.findByDisplayValue('Acme Telecom');

		await user.click(screen.getAllByRole('button', { name: /common_save/ })[0]);

		await vi.waitFor(() =>
			expect(globalToaster.error).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'tel: Too long.' })
			)
		);
		expect(globalToaster.success).not.toHaveBeenCalled();
	});

	test('should delete after confirmation and navigate back to the list', async () => {
		const user = userEvent.setup();
		renderEditor();
		await screen.findByDisplayValue('Acme Telecom');

		await user.click(screen.getAllByRole('button', { name: /common_delete/ })[0]);
		const dialog = await screen.findByRole('dialog');
		await user.click(within(dialog).getByRole('button', { name: 'common_delete' }));

		expect(deletePipelineRecord).toHaveBeenCalledWith('rec-1');
		await vi.waitFor(() => expect(gotoMock).toHaveBeenCalledWith('/pipeline-records'));
	});

	test('should stay on the page when the delete is rejected', async () => {
		const user = userEvent.setup();
		deletePipelineRecord.mockRejectedValue(httpError(409, 'Record is in use.'));
		renderEditor();
		await screen.findByDisplayValue('Acme Telecom');

		await user.click(screen.getAllByRole('button', { name: /common_delete/ })[0]);
		const dialog = await screen.findByRole('dialog');
		await user.click(within(dialog).getByRole('button', { name: 'common_delete' }));

		await vi.waitFor(() =>
			expect(globalToaster.error).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'Record is in use.' })
			)
		);
		expect(gotoMock).not.toHaveBeenCalled();
	});
});
