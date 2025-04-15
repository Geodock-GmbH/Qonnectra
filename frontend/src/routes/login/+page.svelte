<script>
	// Paraglide
	import { m } from '$lib/paraglide/messages';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { goto } from '$app/navigation';
	import { Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// TODO: Toaster should be placed bottom center.
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	let username;
	let password;
	let error;
	let loading = false;

	async function login() {
		// Reset error state if needed
		error = '';

		try {
			const response = await fetch(`${PUBLIC_API_URL}/api/v1/auth/login/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({ username, password })
			});

			if (response.ok) {
				// Login successful
				await goto('/'); // Redirect
			} else {
				// Login failed, throw an error to reject the promise
				const responseData = await response.json();
				const errorMessage =
					responseData.non_field_errors?.[0] ||
					responseData.detail ||
					'Login failed. Please check your credentials.';
				console.error('Login error data:', responseData);
				// Throw the error message
				throw new Error(errorMessage);
			}
		} catch (err) {
			console.error('Login fetch error:', err);
			throw new Error(err.message || 'An error occurred during login. Please try again.');
		}
	}
</script>

<Toaster {toaster}></Toaster>

<div class="flex flex-col gap-4 items-center justify-center">
	<!-- Logo -->
	<img src="/favicon.png" alt="Logo" class="w-16 h-16" />
	<!-- Title -->
	<h2 class="text-2xl font-bold">{m.signin()}</h2>
	<!-- Form -->
	<form class="mx-auto w-full max-w-md space-y-4" onsubmit={login}>
		<!-- Username -->
		<div class="flex flex-col gap-2">
			<p class="text-sm">{m.username()}</p>
			<label for="username">
				<input type="text" class="input" required bind:value={username} />
			</label>
		</div>
		<!-- Password -->
		<div class="flex flex-col gap-2">
			<div class="flex flex-row justify-between">
				<p class="text-sm">{m.password()}</p>
			</div>

			<label for="password">
				<input type="password" class="input" required bind:value={password} />
			</label>
		</div>
		<!-- Login Button -->
		<div class="flex flex-col gap-2">
			<button
				type="button"
				class="btn preset-filled-primary-500"
				onclick={async () => {
					if (!username || !password) {
						toaster.create({
							title: m.title_missing_information(),
							description: m.missing_information(),
							type: 'error'
						});
						return; // Prevent login attempt
					}

					toaster.promise(login(), {
						loading: {
							title: m.title_logging_in(),
							description: m.please_wait()
						},
						success: () => ({
							title: m.title_login_success(),
							description: m.login_success()
						}),
						error: (err) => ({
							title: m.title_login_error(),
							description: err.message
						})
					});
				}}>{m.login()}</button
			>
		</div>
	</form>
</div>
