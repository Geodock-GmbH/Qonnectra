<script lang="ts">
	let { id = '', path = '' }: { id?: string; path?: string } = $props();
</script>

<path data-testid="base-edge" {id} d={path} />
