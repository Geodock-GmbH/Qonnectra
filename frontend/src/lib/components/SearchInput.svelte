<script>
	import { IconSearch } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	let { value = $bindable(''), onSearch = () => {} } = $props();

	function handleKeydown(/** @type {KeyboardEvent} */ event) {
		if (event.key === 'Enter') {
			onSearch();
		}
	}
</script>

<div class="search-container group">
	<div class="search-icon">
		<IconSearch size={18} stroke={2.5} />
	</div>
	<input
		id="search-input"
		name="search"
		class="search-input"
		type="search"
		placeholder={m.common_search()}
		bind:value
		onkeydown={handleKeydown}
		autocomplete="off"
		autocorrect="off"
		spellcheck="false"
		data-testid="search-input"
	/>
	<button class="search-button" onclick={() => onSearch()} aria-label={m.common_search()}>
		<IconSearch size={20} stroke={2} />
	</button>
</div>

<style>
	.search-container {
		display: flex;
		align-items: center;
		position: relative;
		background: var(--color-surface-50);
		border-radius: 12px;
		overflow: hidden;
		border: 1.5px solid var(--color-surface-200);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	:global([data-mode='dark']) .search-container {
		background: var(--color-surface-900);
		border-color: var(--color-surface-700);
	}

	.search-container:focus-within {
		border-color: #f59e0b;
		box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
	}

	.search-icon {
		position: absolute;
		left: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-surface-400);
		pointer-events: none;
		transition: color 0.2s ease;
	}

	:global([data-mode='dark']) .search-icon {
		color: var(--color-surface-500);
	}

	.search-container:focus-within .search-icon {
		color: #f59e0b;
	}

	.search-input {
		flex: 1;
		min-height: 48px;
		padding: 0 56px 0 44px;
		background: transparent;
		border: none;
		outline: none;
		font-size: 15px;
		letter-spacing: 0.01em;
		color: var(--color-surface-900);
	}

	:global([data-mode='dark']) .search-input {
		color: var(--color-surface-100);
	}

	.search-input::placeholder {
		color: var(--color-surface-900);
		font-weight: 500;
		letter-spacing: 0.02em;
	}

	:global([data-mode='dark']) .search-input::placeholder {
		color: var(--color-surface-500);
	}

	.search-input::-webkit-search-cancel-button {
		display: none;
	}

	.search-button {
		position: absolute;
		right: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
		border: none;
		border-radius: 8px;
		color: white;
		cursor: pointer;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease;
	}

	.search-button:hover {
		transform: scale(1.05);
		box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35);
	}

	.search-button:active {
		transform: scale(0.95);
	}

	@media (min-width: 640px) {
		.search-input {
			min-height: 42px;
			font-size: 14px;
		}

		.search-button {
			width: 32px;
			height: 32px;
		}

		.search-icon :global(svg) {
			width: 16px;
			height: 16px;
		}
	}
</style>
