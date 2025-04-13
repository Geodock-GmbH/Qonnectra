<script>
	// Paraglide
	import { m } from '$lib/paraglide/messages';
</script>

<div class="flex flex-col gap-4 items-center justify-center">
	<!-- Logo -->
	<img src="/favicon.png" alt="Logo" class="w-16 h-16" />
	<!-- Title -->
	<h2 class="text-2xl font-bold">{m.signin()}</h2>
	<!-- Form -->
	<form class="mx-auto w-full max-w-md space-y-4">
		<!-- Email -->
		<div class="flex flex-col gap-2">
			<p class="text-sm">{m.email()}</p>
			<label for="email">
				<input type="email" class="input" />
			</label>
		</div>
		<!-- Password -->
		<div class="flex flex-col gap-2">
			<div class="flex flex-row justify-between">
				<p class="text-sm">{m.password()}</p>
				<a href="/forgot-password" class="text-sm font-semibold text-primary-500 hover:text-primary-600"
					>{m.forgot_password()}</a
				>
			</div>

			<label for="password">
				<input type="password" class="input" />
			</label>
		</div>
		<!-- Login Button -->
		<div class="flex flex-col gap-2">
			<button type="submit" class="btn preset-filled-primary-500">{m.login()}</button>
		</div>
	</form>
</div>
