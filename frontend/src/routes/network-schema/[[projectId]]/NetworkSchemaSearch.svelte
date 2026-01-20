<script>
	import { useSvelteFlow } from '@xyflow/svelte';
	import { IconLine, IconPoint, IconSearch, IconX } from '@tabler/icons-svelte';
	import { parse } from 'devalue';

	import { m } from '$lib/paraglide/messages';

	import { drawerStore } from '$lib/stores/drawer';

	import DrawerTabs from './DrawerTabs.svelte';

	let {
		searchManager,
		schemaState,
		panToResult = true,
		highlightResult = true,
		openDrawer = true
	} = $props();

	const { setCenter } = useSvelteFlow();

	let inputElement = $state(null);
	let isDropdownOpen = $state(false);
	let selectedIndex = $state(-1);

	let results = $derived(searchManager.searchResults);

	function handleInput(e) {
		searchManager.searchTerm = e.target.value;
		isDropdownOpen = searchManager.searchTerm.length > 0;
		selectedIndex = -1;
	}

	function handleKeyDown(e) {
		if (!isDropdownOpen || results.length === 0) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, -1);
				break;
			case 'Enter':
				e.preventDefault();
				if (selectedIndex >= 0 && selectedIndex < results.length) {
					selectResult(results[selectedIndex]);
				}
				break;
			case 'Escape':
				e.preventDefault();
				clearSearch();
				break;
		}
	}

	function clearSearch() {
		searchManager.clearSearch();
		isDropdownOpen = false;
		selectedIndex = -1;
	}

	/**
	 * Handle result selection - pans to item, highlights it, and optionally opens drawer
	 * @param {Object} result - The search result object
	 */
	async function selectResult(result) {
		isDropdownOpen = false;
		selectedIndex = -1;

		// Get position to pan to
		const position = searchManager.getResultPosition(result);

		// Pan to the result
		if (panToResult && position) {
			setCenter(position.x, position.y, { duration: 500, zoom: 1 });
		}

		// Select the node/edge to show green highlight border
		if (highlightResult) {
			if (result.type === 'node') {
				schemaState.selectNode(result.id);
			} else {
				schemaState.selectEdge(result.id);
			}
		}

		// Open drawer with item details
		if (openDrawer) {
			if (result.type === 'node') {
				await openNodeDrawer(result.id);
			} else {
				await openCableDrawer(result.id);
			}
		}

		// Clear search after selection
		searchManager.searchTerm = '';
	}

	/**
	 * Fetch and open node details in drawer
	 * @param {string} nodeId - Node UUID
	 */
	async function openNodeDrawer(nodeId) {
		const formData = new FormData();
		formData.append('uuid', nodeId);
		const response = await fetch('?/getNodes', {
			method: 'POST',
			body: formData
		});
		const result = await response.json();
		const parsedData = typeof result.data === 'string' ? parse(result.data) : result.data;

		drawerStore.open({
			title: parsedData?.properties?.name || 'Node Details',
			component: DrawerTabs,
			props: {
				id: nodeId,
				...parsedData.properties,
				type: 'node',
				onLabelUpdate: (newLabel) => {
					drawerStore.setTitle(newLabel);
				}
			}
		});
	}

	/**
	 * Fetch and open cable details in drawer
	 * @param {string} cableId - Cable UUID
	 */
	async function openCableDrawer(cableId) {
		const formData = new FormData();
		formData.append('uuid', cableId);
		const response = await fetch('?/getCables', {
			method: 'POST',
			body: formData
		});
		const result = await response.json();
		const parsedData = typeof result.data === 'string' ? parse(result.data) : result.data;

		drawerStore.open({
			title: parsedData?.name || 'Cable Details',
			component: DrawerTabs,
			props: {
				...parsedData,
				type: 'edge',
				onLabelUpdate: (newLabel) => {
					drawerStore.setTitle(newLabel);
				}
			}
		});
	}

	function handleBlur() {
		// Delay closing to allow click on dropdown items
		setTimeout(() => {
			isDropdownOpen = false;
		}, 200);
	}
</script>

<div class="relative w-full">
	<div class="input-group grid-cols-[1fr_auto] rounded-lg overflow-hidden shadow-sm">
		<input
			bind:this={inputElement}
			type="text"
			class="ig-input touch-manipulation text-sm min-h-[40px] px-3 bg-surface-50-950 border-0 focus:ring-2 focus:ring-primary-500/50 transition-shadow"
			placeholder={m.common_search()}
			value={searchManager.searchTerm}
			oninput={handleInput}
			onkeydown={handleKeyDown}
			onblur={handleBlur}
			onfocus={() => {
				if (searchManager.searchTerm.length > 0) {
					isDropdownOpen = true;
				}
			}}
			autocomplete="off"
		/>
		<button
			type="button"
			class="ig-btn preset-filled-primary-500 min-h-[40px] min-w-[40px] flex items-center justify-center"
			onclick={() => {
				if (searchManager.searchTerm.length > 0) {
					clearSearch();
				}
			}}
			aria-label={m.common_search()}
		>
			{#if searchManager.searchTerm.length > 0}
				<IconX size={18} />
			{:else}
				<IconSearch size={18} />
			{/if}
		</button>
	</div>

	{#if isDropdownOpen && results.length > 0}
		<div
			class="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border border-surface-200-800 bg-surface-50-950 shadow-lg"
		>
			{#each results as result, index (result.id)}
				<button
					type="button"
					class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-200-800 {selectedIndex ===
					index
						? 'bg-surface-200-800'
						: ''}"
					onclick={() => selectResult(result)}
					onmouseenter={() => (selectedIndex = index)}
				>
					{#if result.type === 'node'}
						<IconPoint size={16} class="text-primary-500 flex-shrink-0" />
					{:else}
						<IconLine size={16} class="text-secondary-500 flex-shrink-0" />
					{/if}
					<span class="truncate flex-1">{result.name}</span>
					<span class="text-xs text-surface-400 flex-shrink-0">
						{result.type === 'node' ? m.form_node() : m.form_cables()}
					</span>
				</button>
			{/each}
		</div>
	{:else if isDropdownOpen && searchManager.searchTerm.length > 0 && results.length === 0}
		<div
			class="absolute z-50 mt-1 w-full rounded-md border border-surface-200-800 bg-surface-50-950 shadow-lg p-3 text-center text-sm text-surface-400"
		>
			{m.message_no_results_found()}
		</div>
	{/if}
</div>
