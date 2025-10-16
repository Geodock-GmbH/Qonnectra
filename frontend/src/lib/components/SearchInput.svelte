<script>
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Icons
	import { IconSearch } from '@tabler/icons-svelte';

	let { value = $bindable(''), onSearch = () => {} } = $props();

	function handleKeydown(event) {
		if (event.key === 'Enter') {
			onSearch();
		}
	}
</script>

<!-- Search -->
<div class="input-group grid-cols-[auto_1fr_auto]">
	<input
		class="ig-input touch-manipulation text-base lg:text-sm min-h-[44px] lg:min-h-[36px]"
		type="search"
		placeholder={m.common_search()}
		bind:value
		onkeydown={handleKeydown}
	/>
	<button
		class="ig-btn preset-filled-primary-500 min-h-[44px] lg:min-h-[36px] px-3 lg:px-4"
		onclick={onSearch}
	>
		<IconSearch size={20} />
	</button>
</div>
