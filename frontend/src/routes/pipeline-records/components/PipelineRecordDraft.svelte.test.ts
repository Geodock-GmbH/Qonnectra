import type { PipelineRecord } from '$lib/remote/pipeline-records/record-data';
import { describe, expect, test } from 'vitest';

import { PipelineRecordDraft } from './PipelineRecordDraft.svelte';

const OPTIONS = {
	typeOfWork: [
		{ value: 3, label: 'Excavation' },
		{ value: 4, label: 'Drilling' }
	],
	requestReason: [{ value: 7, label: 'Expansion' }]
};

function makeRecord(overrides: Partial<PipelineRecord> = {}): PipelineRecord {
	return {
		uuid: 'rec-1',
		project_name: 'Fiber North',
		type_of_work: 'Drilling',
		request_reason: 'Expansion',
		organisation: 'Acme Telecom',
		name: 'Jane Doe',
		tel: '0123',
		mobile: '0170',
		...overrides
	};
}

describe('PipelineRecordDraft', () => {
	test('should start empty and turn unselected lookups into null', () => {
		expect(new PipelineRecordDraft().toInput()).toEqual({
			typeOfWorkId: null,
			requestReasonId: null,
			organisation: '',
			name: '',
			tel: '',
			mobile: ''
		});
	});

	test('should select the lookups whose labels match the saved record', () => {
		const draft = PipelineRecordDraft.fromRecord(makeRecord(), OPTIONS);

		expect(draft.typeOfWorkId).toBe('4');
		expect(draft.requestReasonId).toBe('7');
		expect(draft.toInput()).toEqual({
			typeOfWorkId: 4,
			requestReasonId: 7,
			organisation: 'Acme Telecom',
			name: 'Jane Doe',
			tel: '0123',
			mobile: '0170'
		});
	});

	test('should leave a lookup unselected when the record names an unknown option', () => {
		const draft = PipelineRecordDraft.fromRecord(makeRecord({ type_of_work: 'Blasting' }), OPTIONS);

		expect(draft.typeOfWorkId).toBe('');
		expect(draft.toInput().typeOfWorkId).toBeNull();
	});

	test('should reflect edits in the written input', () => {
		const draft = PipelineRecordDraft.fromRecord(makeRecord(), OPTIONS);
		draft.organisation = 'Globex';
		draft.typeOfWorkId = '';

		expect(draft.toInput().organisation).toBe('Globex');
		expect(draft.toInput().typeOfWorkId).toBeNull();
	});
});
