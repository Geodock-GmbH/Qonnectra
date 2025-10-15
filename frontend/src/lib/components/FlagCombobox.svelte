<script>
	// Skeleton
	import { Combobox, Portal, useListCollection } from '@skeletonlabs/skeleton-svelte';
	// Svelte
	import { browser } from '$app/environment';
	import { selectedFlag } from '$lib/stores/store';
	// Paraglide
	import { m } from '$lib/paraglide/messages';
	import { globalToaster } from '$lib/stores/toaster';
	let { flags = [], flagsError = null, loading = false, onchange = (_) => {} } = $props();

	let isHydrating = $state(!browser);

	const collection = $derived(
		useListCollection({
			items: flags,
			itemToString: (item) => item?.label ?? '',
			itemToValue: (item) => item?.value ?? ''
		})
	);

	let items = $derived(collection.items);

	$effect(() => {
		if (flagsError && browser) {
			globalToaster.error({
				title: m.title_error_fetching_flags(),
				description: flagsError
			});
		}
	});

	$effect(() => {
		if (browser) {
			isHydrating = false;
		}
	});

	function handleValueChange(e) {
		$selectedFlag = e.value;
		onchange(e);
	}

	const onInputValueChange = (e) => {
		const filtered = flags.filter((item) =>
			item.label.toLowerCase().includes(e.inputValue.toLowerCase())
		);
		if (filtered.length > 0) {
			items = filtered;
		} else {
			items = flags;
		}
	};
</script>

<!-- Loading -->
{#if loading || isHydrating}
	<div class="placeholder animate-pulse"></div>
{:else if flagsError}
	<div class="alert variant-filled-error">{flagsError}</div>
{:else if flags.length === 0}
	<div class="alert variant-filled-warning">{m.message_error_fetching_flags_no_flags()}</div>
{:else}
	<!-- FlagCombobox -->
	<Combobox
		class="touch-manipulation w-full"
		placeholder={m.placeholder_select_flag()}
		{collection}
		defaultValue={$selectedFlag}
		onValueChange={handleValueChange}
		{onInputValueChange}
	>
		<Combobox.Control>
			<Combobox.Input />
			<Combobox.Trigger />
		</Combobox.Control>
		<Portal>
			<Combobox.Positioner class="z-10">
				<Combobox.Content
					class="z-50 max-h-60 overflow-auto touch-manipulation rounded-md border border-surface-200-800 bg-surface-50-950 shadow-lg"
				>
					{#each items as item (item.value)}
						<Combobox.Item {item}>
							<Combobox.ItemText>{item.label}</Combobox.ItemText>
							<Combobox.ItemIndicator />
						</Combobox.Item>
					{/each}
				</Combobox.Content>
			</Combobox.Positioner>
		</Portal>
	</Combobox>
{/if}
