<script>
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Skeleton
	import { Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// SvelteKit
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';

	// TODO: Toaster should be placed bottom center.
	// Since the UI is not clear right now, the centered button would not be centered.
	// so we're placing it at the bottom right for now.
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	let username;
	let password;

	// Read redirectTo query parameter
	let redirectTo = $page.url.searchParams.get('redirectTo') || '/';

	/** @type {import('./$types').ActionData} */
	export let form; // Receive action data from the server

	// Reactive statement to show toast on error
	// TODO: Login successful toast, should be on the redirectTo page.
	$: if (form?.error) {
		toaster.create({
			title: m.title_login_error(),
			description: form.error,
			type: 'error'
		});
	}
</script>

<Toaster {toaster}></Toaster>

<div class="flex flex-col gap-4 items-center justify-center">
	<!-- Logo -->
	<img src="/favicon.png" alt="Logo" class="w-16 h-16" />
	<!-- Title -->
	<h2 class="text-2xl font-bold">{m.signin()}</h2>
	<!-- Form -->
	<!-- Use enhance for progressive enhancement -->
	<form
		method="POST"
		action="?/login"
		class="mx-auto w-full max-w-md space-y-4"
		use:enhance={() => {
			// Return a callback for after submission
			return async ({ update }) => {
				// update() runs after the action completes
				// The redirect is handled by the server action,
				// or SvelteKit updates `form` prop with errors.
				await update();
			};
		}}
	>
		<!-- Hidden input for redirectTo -->
		<input type="hidden" name="redirectTo" value={redirectTo} />

		<!-- Username -->
		<div class="flex flex-col gap-2">
			<p class="text-sm">{m.username()}</p>
			<label for="username">
				<input type="text" name="username" class="input" required bind:value={username} />
			</label>
		</div>
		<!-- Password -->
		<div class="flex flex-col gap-2">
			<div class="flex flex-row justify-between">
				<p class="text-sm">{m.password()}</p>
			</div>

			<label for="password">
				<input type="password" name="password" class="input" required bind:value={password} />
			</label>
		</div>
		<!-- Login Button -->
		<div class="flex flex-col gap-2">
			<button type="submit" class="btn preset-filled-primary-500">
				{m.login()}
			</button>
		</div>
	</form>
</div>
