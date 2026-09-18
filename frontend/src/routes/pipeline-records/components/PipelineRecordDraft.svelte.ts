import type { PipelineRecord, PipelineRecordInput } from '$lib/remote/pipeline-records/record-data';
import type { ComboboxItem } from '$lib/types/attributeCardTypes';

import { resolveOptionValue } from '$lib/remote/pipeline-records/record-data';

interface LookupOptions {
	typeOfWork: ComboboxItem[];
	requestReason: ComboboxItem[];
}

/**
 * The values being edited in the pipeline-record form, shared between the
 * fields and the page that saves them.
 */
export class PipelineRecordDraft {
	typeOfWorkId = $state('');
	requestReasonId = $state('');
	organisation = $state('');
	name = $state('');
	tel = $state('');
	mobile = $state('');

	/**
	 * Starts a draft from a saved record, selecting the lookups whose labels
	 * match the record's display names.
	 * @param record - The saved record.
	 * @param options - The lookup options the form offers.
	 */
	static fromRecord(record: PipelineRecord, options: LookupOptions): PipelineRecordDraft {
		const draft = new PipelineRecordDraft();
		draft.typeOfWorkId = resolveOptionValue(options.typeOfWork, record.type_of_work);
		draft.requestReasonId = resolveOptionValue(options.requestReason, record.request_reason);
		draft.organisation = record.organisation;
		draft.name = record.name;
		draft.tel = record.tel;
		draft.mobile = record.mobile;
		return draft;
	}

	/**
	 * The draft as the write commands expect it; unselected lookups become `null`.
	 */
	toInput(): PipelineRecordInput {
		return {
			typeOfWorkId: Number(this.typeOfWorkId) || null,
			requestReasonId: Number(this.requestReasonId) || null,
			organisation: this.organisation,
			name: this.name,
			tel: this.tel,
			mobile: this.mobile
		};
	}
}
