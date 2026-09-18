<script lang="ts">
	import { page } from '$app/state';
	import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
	import { IconChevronDown, IconDownload } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';
	import { generateAddressPdf } from '$lib/utils/addressPdf';
	import { addressPdfLabels, toPdfAddress, toPdfUnit } from '$lib/utils/addressPdfInput';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { captureMapCanvases, getVisibleWMSAttributions } from '$lib/utils/mapCapture';
	import { tooltip } from '$lib/utils/tooltip';
	import {
		getAddress,
		getAddressFiberConnections,
		getAddressLinks
	} from '$lib/remote/address/addresses.remote';
	import { getResidentialUnits } from '$lib/remote/address/residential-units.remote';

	let {
		uuid,
		projectId,
		mapContainer,
		coordsDefault,
		coords4326
	}: {
		uuid: string;
		projectId: string;
		mapContainer: HTMLElement | null;
		coordsDefault: string | null;
		coords4326: string | null;
	} = $props();

	let isDownloading = $state(false);
	let includeResidentialUnits = $state(false);

	/**
	 * Generates and downloads the address PDF, optionally with residential
	 * units and their fiber connections.
	 */
	async function handleDownloadPdf() {
		isDownloading = true;
		try {
			const [address, residentialUnits, links] = await Promise.all([
				getAddress(uuid),
				getResidentialUnits(uuid),
				getAddressLinks(uuid)
			]);
			const fiberConnections =
				includeResidentialUnits && residentialUnits.length > 0
					? await getAddressFiberConnections(uuid)
					: {};

			generateAddressPdf({
				address: toPdfAddress(address, { coordsDefault, coords4326, srid: page.data.srid }),
				residentialUnits: residentialUnits.map((unit) => toPdfUnit(unit, fiberConnections)),
				mapImage: mapContainer ? captureMapCanvases(mapContainer) : null,
				includeResidentialUnits,
				linkedMicroducts: links.microducts,
				wmsAttributions: getVisibleWMSAttributions(projectId),
				labels: addressPdfLabels()
			});

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_downloading_pdf()
			});
		} catch (error) {
			console.error('Error generating PDF:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error generating PDF',
				extraData: {
					from: 'AddressPdfDownload.handleDownloadPdf',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_downloading_pdf()
			});
		} finally {
			isDownloading = false;
		}
	}
</script>

<div class="inline-flex rounded-lg overflow-hidden">
	<button
		onclick={handleDownloadPdf}
		class="btn preset-tonal-primary rounded-none inline-flex items-center gap-2"
		disabled={isDownloading}
		{@attach tooltip(m.tooltip_download_address_pdf(), { delay: 1000 })}
	>
		{#if isDownloading}
			<span>{m.common_loading()}</span>
		{:else}
			<IconDownload class="size-4 shrink-0" />
			<span>{m.action_download_pdf()}</span>
		{/if}
	</button>
	<Menu>
		<Menu.Trigger
			class="btn preset-tonal-primary rounded-none border-l border-primary-500/30 px-2"
			disabled={isDownloading}
		>
			<IconChevronDown class="size-4" />
		</Menu.Trigger>
		<Portal>
			<Menu.Positioner>
				<Menu.Content class="card p-2 shadow-xl space-y-1 min-w-48">
					<label
						class="flex items-center gap-3 px-3 py-2 rounded-md hover:preset-tonal-primary cursor-pointer select-none transition-colors"
					>
						<input
							id="include-residential-units"
							name="include_residential_units"
							type="checkbox"
							class="checkbox"
							bind:checked={includeResidentialUnits}
						/>
						<span class="text-sm">{m.pdf_include_residential_units()}</span>
					</label>
				</Menu.Content>
			</Menu.Positioner>
		</Portal>
	</Menu>
</div>
