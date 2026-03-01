<script>
	let { data, value, placeholder, ...props } = $props();
</script>

<div data-testid="generic-combobox" data-placeholder={placeholder} {...props}>
	<select>
		{#if data}
			{#each data as item}
				<option value={item.id || item.value}>{item.label || item.name}</option>
			{/each}
		{/if}
	</select>
</div>
