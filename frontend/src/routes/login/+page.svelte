<script>
	// Paraglide
	import { m } from '$lib/paraglide/messages';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { enhance } from '$app/forms'; // Import enhance
	import { Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';
	import { page } from '$app/stores'; // Import page store to read URL parameters

	// TODO: Toaster should be placed bottom center.
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	let username;
	let password;

	// Read redirectTo query parameter
	let redirectTo = $page.url.searchParams.get('redirectTo') || '/';

	/** @type {import('./$types').ActionData} */
	export let form; // Receive action data from the server
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
		action= "?/login"
		class="mx-auto w-full max-w-md space-y-4"
		use:enhance={() => {
			// Optional: Add logic before form submission (e.g., disable button)
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

		<!-- Display server-side error if it exists -->
		{#if form?.error}
			<div class="alert variant-filled-error" role="alert">
				<p>{form.error}</p>
			</div>
		{/if}

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
			<!-- Changed to type="submit", removed disabled attribute -->
			<button type="submit" class="btn preset-filled-primary-500">
				{m.login()}
			</button>
		</div>
	</form>
</div>
