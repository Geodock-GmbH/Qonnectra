<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { IconDownload, IconMapSearch } from '@tabler/icons-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';
	import { saveFile } from '$lib/utils/saveFile';
	import { getInquiryAreas } from '$lib/remote/pipeline-records/inquiry-areas.remote';

	interface Props {
		recordUuid: string;
		/** Extra classes for each button (e.g. `flex-1` in the stacked mobile row). */
		buttonClass?: string;
	}

	let { recordUuid, buttonClass = '' }: Props = $props();

	let isExporting = $state(false);

	const areas = $derived(await getInquiryAreas(recordUuid));
	const hasInquiry = $derived(areas.length > 0);

	/** Downloads the inquiry export ZIP, prompting the user to choose a save location. */
	async function handleExport() {
		isExporting = true;
		try {
			const response = await fetch(
				`${PUBLIC_API_URL}pipeline-records/${recordUuid}/inquiry-export/`,
				{ credentials: 'include' }
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				globalToaster.error({
					title: m.common_error(),
					description: errorData.detail || m.message_inquiry_export_failed()
				});
				return;
			}

			await saveFile(await response.blob(), `inquiry-export-${recordUuid}.zip`);

			globalToaster.success({
				title: m.title_success(),
				description: m.message_inquiry_export_success()
			});
		} catch (err) {
			globalToaster.error({
				title: m.common_error(),
				description: err instanceof Error ? err.message : String(err)
			});
		} finally {
			isExporting = false;
		}
	}
</script>

<button
	type="button"
	class={['btn preset-filled-secondary-500 inline-flex items-center gap-2', buttonClass]}
	onclick={() => goto(resolve('/pipeline-records/[uuid]/inquiry', { uuid: recordUuid }))}
>
	<IconMapSearch class="size-4 shrink-0" />
	<span>{hasInquiry ? m.action_edit_inquiry() : m.action_new_inquiry()}</span>
</button>

{#if hasInquiry}
	<button
		type="button"
		class={['btn preset-filled-success-500 inline-flex items-center gap-2', buttonClass]}
		disabled={isExporting}
		onclick={handleExport}
	>
		<IconDownload class="size-4 shrink-0" />
		<span>{isExporting ? m.common_loading() : m.action_export_inquiry()}</span>
	</button>
{/if}
