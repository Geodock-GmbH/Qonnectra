<script lang="ts">
	let {
		trenches,
		selectedKeys,
		lockedKeys,
		onConfirm,
		onCancel,
		...props
	}: {
		trenches?: any;
		selectedKeys?: any;
		lockedKeys?: any;
		onConfirm?: any;
		onCancel?: any;
		[key: string]: any;
	} = $props();
</script>

<div data-testid="trench-selector" {...props}></div>
