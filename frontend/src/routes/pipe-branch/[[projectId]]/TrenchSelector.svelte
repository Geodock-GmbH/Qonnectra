<script>
	import { Accordion } from '@skeletonlabs/skeleton-svelte';
	import {
		IconLock,
		IconMinus,
		IconPlus,
		IconSquare,
		IconSquareCheck,
		IconSquareMinus
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	/**
	 * Selection key format: "trenchUuid:conduitUuid"
	 * This allows the same conduit to be selected/deselected independently per trench
	 *
	 * @type {{
	 *   trenches: Array<{uuid: string, id_trench: string, conduits: Array<{uuid: string, name: string, microducts: Array<any>}>}>,
	 *   selectedKeys: string[],
	 *   lockedKeys: string[],
	 *   onConfirm: (selectedTrenches: Array<any>) => void,
	 *   onCancel: () => void
	 * }}
	 */
	let {
		trenches = [],
		selectedKeys = $bindable([]),
		lockedKeys = [],
		onConfirm = () => {},
		onCancel = () => {}
	} = $props();

	/**
	 * Create a composite key for the trench and conduit
	 * @param {string} trenchUuid - The UUID of the trench
	 * @param {string} conduitUuid - The UUID of the conduit
	 * @returns {string} - The composite key
	 */
	function makeKey(trenchUuid, conduitUuid) {
		return `${trenchUuid}:${conduitUuid}`;
	}

	/**
	 * Toggle the selection of a conduit
	 * @param {string} trenchUuid - The UUID of the trench
	 * @param {string} conduitUuid - The UUID of the conduit
	 */
	function toggleConduit(trenchUuid, conduitUuid) {
		const key = makeKey(trenchUuid, conduitUuid);

		if (lockedKeys.includes(key)) {
			return;
		}

		if (selectedKeys.includes(key)) {
			selectedKeys = selectedKeys.filter((k) => k !== key);
		} else {
			selectedKeys = [...selectedKeys, key];
		}
	}

	/**
	 * Toggle the selection of all conduits in a trench
	 * @param {object} trench - The trench object
	 */
	function toggleAllConduitsInTrench(trench) {
		const trenchKeys = trench.conduits?.map((c) => makeKey(trench.uuid, c.uuid)) || [];
		const allSelected = trenchKeys.every((key) => selectedKeys.includes(key));

		if (allSelected) {
			selectedKeys = selectedKeys.filter(
				(key) => !trenchKeys.includes(key) || lockedKeys.includes(key)
			);
		} else {
			const newKeys = trenchKeys.filter((key) => !selectedKeys.includes(key));
			selectedKeys = [...selectedKeys, ...newKeys];
		}
	}

	/**
	 * Select all conduits
	 */
	function selectAll() {
		const allKeys = trenches.flatMap((t) => t.conduits?.map((c) => makeKey(t.uuid, c.uuid)) || []);
		selectedKeys = [...new Set([...selectedKeys, ...allKeys])];
	}

	/**
	 * Select none of the conduits
	 */
	function selectNone() {
		selectedKeys = lockedKeys.filter((key) =>
			trenches.some((t) => t.conduits?.some((c) => makeKey(t.uuid, c.uuid) === key))
		);
	}

	/**
	 * Get the number of selected conduits in a trench
	 * @param {object} trench - The trench object
	 * @returns {number} - The number of selected conduits
	 */
	function getSelectedConduitCount(trench) {
		return (
			trench.conduits?.filter((c) => selectedKeys.includes(makeKey(trench.uuid, c.uuid))).length ||
			0
		);
	}

	/**
	 * Get the selection state of a trench
	 * @param {object} trench - The trench object
	 * @returns {string} - The selection state
	 */
	function getTrenchSelectionState(trench) {
		const total = trench.conduits?.length || 0;
		const selected = getSelectedConduitCount(trench);
		if (selected === 0) return 'none';
		if (selected === total) return 'all';
		return 'partial';
	}

	/**
	 * Check if a conduit is locked
	 * @param {string} trenchUuid - The UUID of the trench
	 * @param {string} conduitUuid - The UUID of the conduit
	 * @returns {boolean} - True if the conduit is locked, false otherwise
	 */
	function isConduitLocked(trenchUuid, conduitUuid) {
		return lockedKeys.includes(makeKey(trenchUuid, conduitUuid));
	}

	/**
	 * Check if a conduit is selected
	 * @param {string} trenchUuid - The UUID of the trench
	 * @param {string} conduitUuid - The UUID of the conduit
	 * @returns {boolean} - True if the conduit is selected, false otherwise
	 */
	function isConduitSelected(trenchUuid, conduitUuid) {
		return selectedKeys.includes(makeKey(trenchUuid, conduitUuid));
	}

	/**
	 * Get the number of microducts in a conduit
	 * @param {object} conduit - The conduit object
	 * @returns {number} - The number of microducts
	 */
	function getMicroductCount(conduit) {
		return conduit.microducts?.length || 0;
	}

	/**
	 * Get the total number of selected conduits
	 * @returns {number} - The total number of selected conduits
	 */
	function getTotalSelectedConduits() {
		return selectedKeys.length;
	}

	/**
	 * Handle the confirmation of the trench selection
	 */
	function handleConfirm() {
		const selectedTrenches = trenches
			.map((trench) => ({
				...trench,
				conduits:
					trench.conduits?.filter((c) => selectedKeys.includes(makeKey(trench.uuid, c.uuid))) || []
			}))
			.filter((trench) => trench.conduits.length > 0);

		onConfirm(selectedTrenches);
	}
</script>

<div class="card preset-filled-surface-50-950 p-4 flex flex-col max-h-[80vh] min-h-0">
	<div class="flex-shrink-0 flex items-center justify-between mb-4">
		<h2 class="text-lg font-semibold">{m.title_select_trenches()}</h2>
		<div class="pl-4 flex gap-2">
			<button type="button" class="btn btn-sm preset-outlined-surface-500" onclick={selectAll}>
				{m.action_select_all()}
			</button>
			<button type="button" class="btn btn-sm preset-outlined-surface-500" onclick={selectNone}>
				{m.action_select_none()}
			</button>
		</div>
	</div>

	<div class="flex-shrink-0 text-sm text-surface-600-300 mb-4">
		{m.message_trenches_found({ count: trenches.length })} | {m.common_selected()}:
		{getTotalSelectedConduits()}
		{m.form_conduit({ count: getTotalSelectedConduits() })}
	</div>

	<div class="flex-1 min-h-0 overflow-y-auto">
		<Accordion multiple>
			{#each trenches as trench (trench.uuid)}
				{@const selectionState = getTrenchSelectionState(trench)}
				{@const selectedCount = getSelectedConduitCount(trench)}
				{@const totalCount = trench.conduits?.length || 0}

				<Accordion.Item value={trench.uuid}>
					<Accordion.ItemTrigger class="flex justify-between items-center">
						<div class="flex items-center gap-3">
							<button
								type="button"
								class="cursor-pointer"
								role="checkbox"
								aria-checked={selectionState === 'all'}
								tabindex="0"
								onclick={(e) => {
									e.stopPropagation();
									toggleAllConduitsInTrench(trench);
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										e.stopPropagation();
										toggleAllConduitsInTrench(trench);
									}
								}}
							>
								{#if selectionState === 'all'}
									<IconSquareCheck class="size-8 text-primary-500" />
								{:else if selectionState === 'partial'}
									<IconSquareMinus class="size-8 text-primary-500" />
								{:else}
									<IconSquare class="size-8 text-surface-400" />
								{/if}
							</button>
							<div class="text-left">
								<div class="font-semibold">
									{m.form_trench_id()}: {trench.id_trench}
								</div>
								<div class="text-sm text-surface-600-300">
									{selectedCount}/{totalCount}
									{m.form_conduit({ count: selectedCount })}
								</div>
							</div>
						</div>
						<Accordion.ItemIndicator class="group">
							<IconMinus class="size-4 group-data-[state=open]:block hidden" />
							<IconPlus class="size-4 group-data-[state=open]:hidden block" />
						</Accordion.ItemIndicator>
					</Accordion.ItemTrigger>
					<Accordion.ItemContent>
						{#if trench.conduits?.length > 0}
							<div>
								{#each trench.conduits as conduit (conduit.uuid)}
									{@const isSelected = isConduitSelected(trench.uuid, conduit.uuid)}
									{@const isLocked = isConduitLocked(trench.uuid, conduit.uuid)}
									<button
										type="button"
										class="w-full px-4 py-2 flex items-center gap-3 text-left hover:preset-tonal-primary transition-colors
											{isLocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}"
										onclick={() => toggleConduit(trench.uuid, conduit.uuid)}
										disabled={isLocked}
									>
										<div class="flex-shrink-0 pl-4">
											{#if isSelected}
												{#if isLocked}
													<IconLock class="size-8 text-primary-500" />
												{:else}
													<IconSquareCheck class="size-8 text-primary-500" />
												{/if}
											{:else}
												<IconSquare class="size-8 text-surface-400" />
											{/if}
										</div>
										<div class="flex-grow">
											<div class="text-sm font-medium flex items-center gap-2">
												{conduit.name || conduit.uuid.slice(0, 8)}
												{#if isLocked}
													<span
														class="text-xs bg-warning-500/20 text-warning-700 dark:text-warning-300 px-1.5 py-0.5 rounded"
													>
														{m.message_has_connections()}
													</span>
												{/if}
											</div>
											<div class="text-xs text-surface-600-300">
												{getMicroductCount(conduit)}x {m.form_microduct({
													count: getMicroductCount(conduit)
												})}
											</div>
										</div>
									</button>
									<hr class="hr" />
								{/each}
							</div>
						{/if}
					</Accordion.ItemContent>
					<hr class="hr" />
				</Accordion.Item>
			{/each}
		</Accordion>
	</div>

	<div class="flex-shrink-0 flex gap-2 pt-4 mt-4 border-t border-surface-200-800">
		<button
			type="button"
			class="btn flex-1 preset-filled-primary-500"
			onclick={handleConfirm}
			disabled={getTotalSelectedConduits() === 0}
		>
			{m.action_load_to_canvas()}
		</button>
		<button
			type="button"
			class="btn preset-filled-error-500 hover:preset-filled-error-600"
			onclick={onCancel}
		>
			{m.common_cancel()}
		</button>
	</div>
</div>
