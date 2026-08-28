<script lang="ts">
	let {
		checked,
		onCheckedChange,
		partial,
		onPartialChange,
		...props
	}: {
		checked?: any;
		onCheckedChange?: any;
		partial?: any;
		onPartialChange?: any;
		[key: string]: any;
	} = $props();
</script>

<div data-testid="lasso-mode-switch" {...props}></div>
