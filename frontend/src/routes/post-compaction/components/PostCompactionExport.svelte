<script lang="ts">
	import { page } from '$app/state';
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { formatLatLon, formatStorageCoordinates } from '$lib/map/projectionUtils';
	import { globalToaster } from '$lib/stores/toaster';
	import { generateAddressPdf } from '$lib/utils/addressPdf';
	import { addressPdfLabels, toPdfAddress, toPdfUnit } from '$lib/utils/addressPdfInput';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { captureMapCanvases, getVisibleWMSAttributions } from '$lib/utils/mapCapture';
	import {
		getAddress,
		getAddressFiberConnections,
		getAddressLinks,
		updateAddress
	} from '$lib/remote/address/addresses.remote';
	import { getStatusDevelopmentOptions } from '$lib/remote/address/attribute-options.remote';
	import { getResidentialUnits } from '$lib/remote/address/residential-units.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	let {
		uuid,
		projectId,
		mapContainer
	}: {
		uuid: string;
		projectId: string;
		mapContainer: HTMLElement | null;
	} = $props();

	const loaded = $derived(await Promise.all([getAddress(uuid), getStatusDevelopmentOptions()]));
	const address = $derived(loaded[0]);
	const statusDevelopments = $derived(loaded[1]);

	let open = $state(false);
	let commentText = $state('');
	let manualStatus = $state<string[] | null>(null);
	let isExporting = $state(false);

	const originalStatusId = $derived(String(address.status_development?.id ?? ''));
	const selectedStatus = $derived(manualStatus ?? (originalStatusId ? [originalStatusId] : []));
	const statusChanged = $derived(
		selectedStatus.length > 0 && selectedStatus[0] !== originalStatusId
	);

	function openDialog() {
		manualStatus = null;
		commentText = '';
		open = true;
	}

	/**
	 * Saves the picked development status.
	 * @returns The updated address, or `null` when the backend refused it.
	 */
	async function saveStatus() {
		try {
			const updated = await updateAddress({
				uuid,
				status_development_id: Number(selectedStatus[0])
			});
			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_address()
			});
			return updated;
		} catch (error) {
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(error) ?? m.message_error_updating_address()
			});
			return null;
		}
	}

	/**
	 * Saves a changed status, then generates the PDF from the address, its
	 * residential units with their fiber connections and the linked microducts.
	 */
	async function handleExport() {
		isExporting = true;
		try {
			const exported = statusChanged ? await saveStatus() : address;
			if (!exported) return;

			const [residentialUnits, links] = await Promise.all([
				getResidentialUnits(uuid),
				getAddressLinks(uuid)
			]);
			const fiberConnections =
				residentialUnits.length > 0 ? await getAddressFiberConnections(uuid) : {};
			const coordinates = exported.geom_3857?.coordinates;

			generateAddressPdf({
				address: toPdfAddress(exported, {
					coordsDefault: coordinates
						? formatStorageCoordinates(coordinates, page.data.srid, page.data.proj4Def)
						: null,
					coords4326: coordinates ? formatLatLon(coordinates) : null,
					srid: page.data.srid
				}),
				residentialUnits: residentialUnits.map((unit) => toPdfUnit(unit, fiberConnections)),
				mapImage: mapContainer ? captureMapCanvases(mapContainer) : null,
				includeResidentialUnits: residentialUnits.length > 0,
				linkedMicroducts: links.microducts,
				wmsAttributions: getVisibleWMSAttributions(projectId),
				commentText,
				labels: addressPdfLabels()
			});

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_downloading_pdf()
			});

			open = false;
		} catch (error) {
			console.error('Error exporting PDF:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error exporting PDF',
				extraData: {
					from: 'PostCompactionExport.handleExport',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_downloading_pdf()
			});
		} finally {
			isExporting = false;
		}
	}
</script>

<button class="btn preset-filled-primary-500 inline-flex items-center gap-2" onclick={openDialog}>
	<span>{m.pc_export()}</span>
</button>

<Dialog
	{open}
	onOpenChange={(e) => (open = e.open)}
	closeOnInteractOutside={true}
	closeOnEscape={true}
>
	<Portal>
		<Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50 backdrop-blur-sm" />

		<Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
			<Dialog.Content
				class="card bg-surface-100-900 p-4 sm:p-6 space-y-4 shadow-xl max-w-screen-sm w-full max-h-[90vh] overflow-y-auto"
			>
				<Dialog.Title>
					<h3 class="text-lg font-bold">{m.nav_post_compaction()}</h3>
				</Dialog.Title>

				<div class="space-y-3">
					<div class="grid grid-cols-2 gap-3 text-sm">
						<div>
							<span class="text-surface-500-400">{m.form_id_address({ count: 1 })}</span>
							<p class="font-mono font-medium">{address.id_address || '–'}</p>
						</div>
						<div>
							<span class="text-surface-500-400">{m.form_street()}</span>
							<p class="font-medium">
								{address.street || '–'}
								{address.housenumber ?? ''}{address.house_number_suffix}
							</p>
						</div>
						<div>
							<span class="text-surface-500-400">{m.form_zip_code()}</span>
							<p class="font-medium">{address.zip_code || '–'}</p>
						</div>
						<div>
							<span class="text-surface-500-400">{m.form_city()}</span>
							<p class="font-medium">{address.city || '–'}</p>
						</div>
						{#if address.district}
							<div>
								<span class="text-surface-500-400">{m.form_district()}</span>
								<p class="font-medium">{address.district}</p>
							</div>
						{/if}
					</div>

					<div class="border-t border-surface-200-800 pt-3">
						<div class="label">
							<span class="label-text text-sm text-surface-900-100">
								{m.form_status_development()}
							</span>
							{#key open}
								<GenericCombobox
									data={statusDevelopments}
									value={selectedStatus}
									defaultValue={selectedStatus}
									placeholder="-"
									onValueChange={(e) => {
										manualStatus = e.value;
									}}
									renderInPlace={true}
								/>
							{/key}
						</div>
					</div>

					<div class="border-t border-surface-200-800 pt-3">
						<label class="label">
							<span class="label-text text-sm text-surface-900-100">
								{m.pc_section_comment()}
							</span>
							<textarea
								class="textarea min-h-24"
								placeholder={m.pc_comment_placeholder()}
								bind:value={commentText}
							></textarea>
						</label>
					</div>
				</div>

				<footer class="flex gap-2 justify-end pt-2">
					<button class="btn preset-filled" onclick={() => (open = false)}>
						{m.common_cancel()}
					</button>
					<button
						class="btn preset-filled-primary-500 inline-flex items-center gap-2"
						onclick={handleExport}
						disabled={isExporting}
					>
						{#if isExporting}
							<span>{m.common_loading()}</span>
						{:else}
							<span>{m.pc_export_go()}</span>
						{/if}
					</button>
				</footer>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>
