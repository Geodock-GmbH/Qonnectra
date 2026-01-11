<script>
	import { IconSearch } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	let { value = $bindable(''), onSearch = () => {} } = $props();

	function handleKeydown(event) {
		if (event.key === 'Enter') {
			onSearch();
		}
	}
</script>

<!-- Search -->
<div class="input-group grid-cols-[1fr_auto] rounded-lg overflow-hidden shadow-sm">
	<input
		class="ig-input touch-manipulation text-base sm:text-sm min-h-[48px] sm:min-h-[40px] px-4 sm:px-3 bg-surface-50-950 border-0 focus:ring-2 focus:ring-primary-500/50 transition-shadow"
		type="search"
		placeholder={m.common_search()}
		bind:value
		onkeydown={handleKeydown}
		autocomplete="off"
		autocorrect="off"
		spellcheck="false"
	/>
	<button
		class="ig-btn preset-filled-primary-500 min-h-[48px] sm:min-h-[40px] min-w-[56px] sm:min-w-[48px] flex items-center justify-center active:scale-95 transition-transform"
		onclick={onSearch}
		aria-label={m.common_search()}
	>
		<IconSearch size={22} class="sm:size-5" />
	</button>
</div>
