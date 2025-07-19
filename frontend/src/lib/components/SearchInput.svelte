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
	<div class="ig-cell preset-tonal">
		<IconSearch size={16} />
	</div>
	<input
		class="ig-input touch-manipulation text-base"
		type="search"
		placeholder={m.search()}
		bind:value
		onkeydown={handleKeydown}
	/>
	<button class="ig-btn preset-filled-primary-500" onclick={onSearch}>{m.search()}</button>
</div>
