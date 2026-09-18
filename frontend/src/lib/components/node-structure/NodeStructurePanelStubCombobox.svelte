<script lang="ts">
	let {
		data = [],
		value = [],
		onValueChange = () => {}
	}: {
		data?: { value: string; label: string }[];
		value?: string[];
		onValueChange?: (e: { value: string[] }) => void;
	} = $props();
</script>

<select
	data-testid="combobox"
	value={value[0] ?? ''}
	onchange={(e) => onValueChange({ value: [e.currentTarget.value] })}
>
	{#each data as opt (opt.value)}
		<option value={opt.value}>{opt.label}</option>
	{/each}
</select>
