<script>
	import { deserialize } from '$app/forms';
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import { globalToaster } from '$lib/stores/toaster';
	import { generateAddressPdf } from '$lib/utils/addressPdf.js';

	let {
		address,
		residentialUnits = [],
		statusDevelopments = [],
		open = $bindable(false)
	} = $props();

	let commentText = $state('');
	/** @type {string[] | null} */
	let manualStatus = $state(null);
	let isExporting = $state(false);

	const originalStatusId = $derived(String(address?.status_development?.id ?? ''));
	const selectedStatus = $derived(manualStatus ?? (originalStatusId ? [originalStatusId] : []));
	const statusChanged = $derived(
		selectedStatus.length > 0 && selectedStatus[0] !== originalStatusId
	);

	function resetForm() {
		manualStatus = null;
		commentText = '';
	}

	/**
	 * Fetches all fiber connections for all residential units of this address.
	 * @returns {Promise<Record<string, Array<Object>>>}
	 */
	async function fetchAllFiberConnections() {
		try {
			const response = await fetch(`/api/address/${address.uuid}/fiber-connections`);
			if (response.ok) {
				return await response.json();
			}
		} catch (error) {
			console.error('Error fetching fiber connections:', error);
		}
		return {};
	}

	async function handleExport() {
		isExporting = true;
		try {
			let updatedAddress = address;

			if (statusChanged) {
				const formData = new FormData();
				formData.append('uuid', address.uuid);
				formData.append('status_development_id', selectedStatus[0]);

				const response = await fetch('?/updateStatus', {
					method: 'POST',
					body: formData
				});

				const result = deserialize(await response.text());

				if (result.type === 'success') {
					updatedAddress = /** @type {any} */ (result.data)?.address || address;
					globalToaster.success({
						title: m.title_success(),
						description: m.message_success_updating_address()
					});
				} else {
					globalToaster.error({
						title: m.common_error(),
						description:
							/** @type {any} */ (result).data?.message || m.message_error_updating_address()
					});
					return;
				}
			}

			let unitsWithFibers = residentialUnits;
			if (residentialUnits.length > 0) {
				const fiberConnectionsMap = await fetchAllFiberConnections();
				unitsWithFibers = residentialUnits.map((/** @type {any} */ unit) => ({
					...unit,
					fiberConnections: fiberConnectionsMap[unit.uuid] || []
				}));
			}

			generateAddressPdf({
				address: updatedAddress,
				residentialUnits: unitsWithFibers,
				mapImage: null,
				includeResidentialUnits: residentialUnits.length > 0,
				linkedMicroducts: [],
				wmsAttributions: [],
				commentText,
				labels: {
					sectionAddressInformation: m.section_address_information(),
					sectionClassification: m.section_classification(),
					sectionLocation: m.section_location(),
					idAddress: m.form_id_address({ count: 1 }),
					street: m.form_street(),
					housenumber: m.form_housenumber(),
					zipCode: m.form_zip_code(),
					city: m.form_city(),
					district: m.form_district(),
					statusDevelopment: m.form_status_development(),
					flag: m.form_flag(),
					project: m.form_project({ count: 1 }),
					residentialUnit: m.section_residential_units({ count: 2 }),
					sectionIdentification: m.form_id_residential_unit(),
					sectionUnitLocation: m.section_location(),
					sectionResident: m.from_resident(),
					unitId: m.table_residential_unit_id(),
					unitType: m.table_residential_unit_type(),
					unitStatus: m.table_residential_unit_status(),
					floor: m.table_floor(),
					side: m.table_side(),
					buildingSection: m.form_building_section(),
					externalId1: m.form_external_id_1(),
					externalId2: m.form_external_id_2(),
					residentName: m.form_resident_name(),
					residentRecordedDate: m.form_resident_recorded_date(),
					readyForService: m.form_ready_for_service(),
					sectionMicroductConnections: m.section_microduct_connections(),
					tableParentNode: m.table_parent_node(),
					tableNode: m.table_node(),
					tableConduitName: m.table_conduit_name(),
					tableConduitType: m.table_conduit_type(),
					tableNumber: m.table_microduct_number(),
					tableColor: m.table_color(),
					sectionFiberConnections: m.section_fiber_connections(),
					tableCableName: m.table_cable_name(),
					tableFiberAbsolute: m.table_fiber_absolute(),
					tableBundle: m.table_bundle(),
					tableFiber: m.table_fiber(),
					sectionComment: m.pc_section_comment()
				}
			});

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_downloading_pdf()
			});

			open = false;
		} catch (error) {
			console.error('Error exporting PDF:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_downloading_pdf()
			});
		} finally {
			isExporting = false;
		}
	}
</script>

<Dialog
	{open}
	onOpenChange={(e) => {
		open = e.open;
		if (e.open) resetForm();
	}}
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

				{#if address}
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
									{address.housenumber ?? ''}{address.house_number_suffix || ''}
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
										onValueChange={(/** @type {{ value: string[] }} */ e) => {
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
				{/if}
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>
