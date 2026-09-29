<script lang="ts">
	let {
		data,
		value,
		placeholder,
		onValueChange,
		...props
	}: {
		data?: any;
		value?: any;
		placeholder?: any;
		onValueChange?: (e: { value: string[] }) => void;
		[key: string]: any;
	} = $props();
</script>

<div data-testid="generic-combobox" data-placeholder={placeholder} {...props}>
	<select
		value={value?.[0] ?? ''}
		onchange={(e) => onValueChange?.({ value: [e.currentTarget.value] })}
	>
		{#if data}
			{#each data as item}
				<option value={item.id || item.value}>{item.label || item.name}</option>
			{/each}
		{/if}
	</select>
</div>
