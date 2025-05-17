<script>
	// Skelton
	import { Modal } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Icons
	import { IconPlus } from '@tabler/icons-svelte';

	let drawerState = false;

	function drawerCloser() {
		drawerState = false;
	}
</script>

<Modal
	open={drawerState}
	onOpenChange={(e) => (drawerState = e.open)}
	triggerBase="btn preset-filled-primary-500"
	contentBase="bg-surface-100-900 p-4 space-y-4 shadow-xl w-[480px] h-screen"
	positionerJustify="justify-end"
	positionerAlign=""
	positionerPadding=""
	transitionsPositionerIn={{ x: 480, duration: 200 }}
	transitionsPositionerOut={{ x: 480, duration: 200 }}
>
	{#snippet trigger()}
		<IconPlus />
		<span>{m.create_new_project()}</span>
	{/snippet}
	{#snippet content()}
		<header class="flex justify-between">
			<h2 class="h2">Drawer Example</h2>
		</header>
		<article>
			<p class="opacity-60">
				Lorem ipsum dolor sit amet consectetur adipisicing elit. Nam, ab adipisci. Libero cumque
				sunt quis error veritatis amet, expedita voluptatem. Quos repudiandae consequuntur
				voluptatem et dicta quas, reprehenderit velit excepturi?
			</p>
		</article>
	{/snippet}
</Modal>
