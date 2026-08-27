<script lang="ts">
	let { ...props }: { [key: string]: any } = $props();
</script>

<div data-testid="background" {...props}></div>
