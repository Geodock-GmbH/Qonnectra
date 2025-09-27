<script>
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Skeleton
	import { Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// SvelteKit
	import { enhance } from '$app/forms';

	const toaster = createToaster({
		placement: 'bottom-end'
	});

	let username;
	let password;

	// Read redirectTo query parameter
	let redirectTo = '/map';

	/** @type {import('./$types').ActionData} */
	export let form; // Receive action data from the server

	// Reactive statement to show toast on error
	// TODO: Login successful toast, should be on the redirectTo page.
	$: if (form?.error) {
		toaster.create({
			title: m.title_login_error(),
			description: m.message_login_error(),
			type: 'error'
		});
		console.log('form', form.error);
	}
</script>

<Toaster {toaster}></Toaster>

<div class="flex flex-col gap-4 items-center justify-center">
	<!-- Logo -->
	<img src="/favicon.png" alt="Logo" class="w-16 h-16" />
	<!-- Title -->
	<h2 class="text-2xl font-bold">{m.auth_signin()}</h2>
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
			<p class="text-sm">{m.auth_username()}</p>
			<label for="username">
				<input type="text" name="username" class="input" required bind:value={username} />
			</label>
		</div>
		<!-- Password -->
		<div class="flex flex-col gap-2">
			<div class="flex flex-row justify-between">
				<p class="text-sm">{m.auth_password()}</p>
			</div>

			<label for="password">
				<input type="password" name="password" class="input" required bind:value={password} />
			</label>
		</div>
		<!-- Login Button -->
		<div class="flex flex-col gap-2">
			<button type="submit" class="btn preset-filled-primary-500">
				{m.auth_login()}
			</button>
		</div>
	</form>
</div>
