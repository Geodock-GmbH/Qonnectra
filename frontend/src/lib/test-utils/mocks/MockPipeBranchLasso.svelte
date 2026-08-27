<script lang="ts">
	let {
		partial,
		onSelectionChange,
		...props
	}: { partial?: any; onSelectionChange?: any; [key: string]: any } = $props();

	export function clearSelection() {}
</script>

<div data-testid="pipe-branch-lasso" {...props}></div>
