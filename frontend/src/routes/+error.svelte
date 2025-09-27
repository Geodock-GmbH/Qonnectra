<script>
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
</script>

<div class="flex flex-col gap-4 items-center justify-center">
	<h1 class="text-2xl font-bold">{page.status}</h1>
	<p class="text-5xl font-bold">{page.error.message}</p>
	<a href="/login" class="btn preset-filled-primary-500">{m.message_error_go_back_home()}</a>
</div>
