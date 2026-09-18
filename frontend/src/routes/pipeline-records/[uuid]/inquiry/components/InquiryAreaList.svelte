<script lang="ts">
	import type { InquiryArea } from '$lib/remote/pipeline-records/inquiry-area-data';
	import { IconTrash } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';
	import {
		deleteInquiryArea,
		getInquiryAreas,
		renameInquiryArea
	} from '$lib/remote/pipeline-records/inquiry-areas.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	let { recordUuid, areas }: { recordUuid: string; areas: InquiryArea[] } = $props();

	/**
	 * Renames an area; the new name shows at once and reverts if the backend refuses.
	 * @param area - The area being renamed
	 * @param value - The name typed into the row's input
	 */
	async function renameArea(area: InquiryArea, value: string) {
		const name = value.trim();
		if (!name || name === area.name) return;

		try {
			await renameInquiryArea({ recordUuid, areaUuid: area.uuid, name }).updates(
				getInquiryAreas(recordUuid).withOverride((saved) =>
					saved.map((row) => (row.uuid === area.uuid ? { ...row, name } : row))
				)
			);
			globalToaster.success({
				title: m.title_success(),
				description: m.message_inquiry_polygon_renamed()
			});
		} catch (err) {
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(err) ?? m.message_inquiry_polygon_rename_failed()
			});
		}
	}

	/**
	 * Deletes an area; the row leaves the list at once and returns if the backend refuses.
	 * @param area - The area to delete
	 */
	async function removeArea(area: InquiryArea) {
		try {
			await deleteInquiryArea({ recordUuid, areaUuid: area.uuid }).updates(
				getInquiryAreas(recordUuid).withOverride((saved) =>
					saved.filter((row) => row.uuid !== area.uuid)
				)
			);
			globalToaster.success({
				title: m.title_success(),
				description: m.message_inquiry_polygon_deleted()
			});
		} catch (err) {
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(err) ?? m.message_inquiry_polygon_delete_failed()
			});
		}
	}
</script>

{#if areas.length > 0}
	<div
		class="order-2 min-w-0 flex-1 border-2 rounded-lg border-surface-200-800 overflow-y-auto flex flex-col pb-16 md:pb-0 lg:w-72 lg:flex-none lg:shrink-0"
	>
		<div class="p-3 border-b border-surface-200-800">
			<h3 class="text-sm font-semibold text-surface-600 dark:text-surface-400">
				{m.label_inquiry_areas()}
			</h3>
		</div>
		<div class="p-3 space-y-2 flex-1 overflow-y-auto">
			{#each areas as area, i (area.uuid)}
				<div
					class="flex items-center justify-between gap-2 px-3 py-2.5 rounded-md bg-surface-100-900"
				>
					<input
						type="text"
						class="input text-sm bg-transparent border-0 px-1 py-0.5 truncate focus:bg-surface-50-950"
						value={area.name || `${m.label_inquiry_polygon_default()} ${i + 1}`}
						aria-label={m.label_inquiry_area_name()}
						onblur={(e) => renameArea(area, e.currentTarget.value)}
						onkeydown={(e) => {
							if (e.key === 'Enter') e.currentTarget.blur();
							else if (e.key === 'Escape') {
								e.currentTarget.value = area.name || '';
								e.currentTarget.blur();
							}
						}}
					/>
					<button
						type="button"
						class="btn-icon btn-icon-sm preset-tonal-error shrink-0"
						aria-label={m.common_delete()}
						onclick={() => removeArea(area)}
					>
						<IconTrash class="size-3.5" />
					</button>
				</div>
			{/each}
		</div>
	</div>
{/if}
