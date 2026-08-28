<script lang="ts">
	let { ...props }: { [key: string]: any } = $props();
</script>

<div data-testid="controls" {...props}></div>
