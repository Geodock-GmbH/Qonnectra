<script lang="ts">
	import { m } from '$lib/paraglide/messages';
</script>

<svelte:head>
	<title>{m.message_no_access_title()}</title>
</svelte:head>

<div class="mx-auto flex max-w-xl flex-col items-center gap-4 pt-16 text-center">
	<h1 class="text-3xl font-bold">{m.message_no_access_title()}</h1>
	<p>{m.message_no_access_description()}</p>
</div>
