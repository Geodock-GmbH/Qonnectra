<script>
	// Paraglide
	import { m } from '$lib/paraglide/messages';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { goto } from '$app/navigation';

	let username;
	let password;
	let error = '';
	let loading = false;

	async function login() {
		loading = true;
		error = '';
		try {
			const response = await fetch(`${PUBLIC_API_URL}/api/v1/auth/login/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				// credentials: 'include' is CRITICAL here
				// It tells the browser to send cookies (like CSRF) with the request
				// and allows it to receive and set the HttpOnly auth cookies from the response
				credentials: 'include',
				body: JSON.stringify({ username, password })
			});

			if (response.ok) {
				// Login successful, cookies are set by the browser.
				// Navigate to a protected page, the hook will re-run and update the state.
				await goto('/'); // Or wherever you want to redirect
			} else {
				const responseData = await response.json();
				error =
					responseData.non_field_errors?.[0] ||
					responseData.detail ||
					'Login failed. Please check your credentials.';
				console.error('Login error data:', responseData);
			}
		} catch (err) {
			console.error('Login fetch error:', err);
			error = 'An error occurred during login. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

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
			<button type="submit" class="btn preset-filled-primary-500">{m.login()}</button>
		</div>
	</form>
</div>
