<script>
	import { enhance } from '$app/forms';
	import { IconEye, IconEyeOff, IconLock, IconUser } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import AppIcon from '$lib/components/AppIcon.svelte';
	import { globalToaster } from '$lib/stores/toaster';

	let username = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let isSubmitting = $state(false);

	let redirectTo = '/dashboard';

	/** @type {import('./$types').ActionData} */
	let { form } = $props();

	$effect(() => {
		if (form?.error) {
			globalToaster.create({
				title: m.title_login_error(),
				description: m.message_login_error(),
				type: 'error'
			});
		}
	});
</script>

<div class="flex h-full bg-surface-50-950">
	<!-- Left Panel - Decorative (desktop only) -->
	<div
		class="login-hero relative hidden flex-1 items-center justify-center overflow-hidden lg:flex"
	>
		<div class="hero-pattern absolute inset-0 bg-primary-500-950"></div>
		<div class="relative z-10 flex flex-col items-center p-8 text-center text-white">
			<div class="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/95 shadow-lg">
				<AppIcon size="3rem" color="var(--color-primary-600)" />
			</div>
			<h1 class="mt-4 text-4xl font-bold tracking-tight">Qonnectra</h1>
			<p class="mt-3 text-lg opacity-85">
				{m.login_tagline?.()}
			</p>
		</div>
		<div class="pointer-events-none absolute inset-0 bg-primary-500-950">
			<div class="node node-1"></div>
			<div class="node node-2"></div>
			<div class="node node-3"></div>
			<div class="node node-4"></div>
			<div class="node node-5"></div>
			<div class="node node-6"></div>
		</div>
	</div>

	<!-- Right Panel - Form -->
	<div class="flex flex-1 items-center justify-center p-8 lg:flex-none lg:w-[480px]">
		<div class="w-full max-w-[360px]">
			<!-- Mobile logo -->
			<div class="mb-10 flex items-center justify-center gap-3 lg:hidden">
				<AppIcon size="3rem" gradient />
				<span class="text-3xl font-bold text-surface-900-100">Qonnectra</span>
			</div>

			<div class="mb-8 text-center lg:text-left">
				<h2 class="mb-2 text-3xl font-bold text-surface-900-100">{m.auth_signin()}</h2>
				<p class="text-surface-900-100">{m.login_welcome?.() ?? 'Welcome back'}</p>
			</div>

			<form
				method="POST"
				action="?/login"
				class="flex flex-col gap-6"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						await update();
						isSubmitting = false;
					};
				}}
			>
				<input type="hidden" name="redirectTo" value={redirectTo} />

				<div class="flex flex-col gap-2">
					<label for="username" class="text-sm font-medium text-surface-900-100">
						{m.auth_username()}
					</label>
					<div class="relative flex items-center">
						<IconUser size={20} class="pointer-events-none absolute left-4 z-10 text-surface-400" />
						<input
							type="text"
							id="username"
							name="username"
							class="input pl-12"
							required
							bind:value={username}
							autocomplete="username"
							placeholder={m.auth_username_placeholder?.() ?? ''}
						/>
					</div>
				</div>

				<div class="flex flex-col gap-2">
					<label for="password" class="text-sm font-medium text-surface-900-100">
						{m.auth_password()}
					</label>
					<div class="relative flex items-center">
						<IconLock size={20} class="pointer-events-none absolute left-4 z-10 text-surface-400" />
						<input
							type={showPassword ? 'text' : 'password'}
							id="password"
							name="password"
							class="input pl-12 pr-12"
							required
							bind:value={password}
							autocomplete="current-password"
							placeholder="••••••••"
						/>
						<button
							type="button"
							class="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-surface-400 transition-colors hover:text-surface-600"
							onclick={() => (showPassword = !showPassword)}
							tabindex="-1"
						>
							{#if showPassword}
								<IconEyeOff size={20} />
							{:else}
								<IconEye size={20} />
							{/if}
						</button>
					</div>
				</div>

				<button
					type="submit"
					class="btn preset-filled-primary-500 mt-2 w-full gap-2"
					disabled={isSubmitting}
				>
					{#if isSubmitting}
						<span class="spinner"></span>
					{/if}
					<span>{m.auth_login()}</span>
				</button>
			</form>

			<div class="mt-12 text-center">
				<p class="text-xs text-surface-400">&copy; {new Date().getFullYear()} Qonnectra</p>
			</div>
		</div>
	</div>
</div>

<style>
	.login-hero {
		background: linear-gradient(
			135deg,
			var(--color-primary-600) 0%,
			var(--color-primary-700) 50%,
			var(--color-primary-800) 100%
		);
	}

	.hero-pattern {
		background-image:
			radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
			radial-gradient(circle at 75% 75%, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
		background-size: 50px 50px;
		animation: patternShift 20s linear infinite;
	}

	@keyframes patternShift {
		0% {
			transform: translateY(0);
		}
		100% {
			transform: translateY(50px);
		}
	}

	.node {
		position: absolute;
		width: 8px;
		height: 8px;
		background: rgba(255, 255, 255, 0.4);
		border-radius: 50%;
		animation: nodePulse 3s ease-in-out infinite;
	}

	.node::after {
		content: '';
		position: absolute;
		width: 100%;
		height: 100%;
		background: inherit;
		border-radius: 50%;
		animation: nodeRing 3s ease-out infinite;
	}

	@keyframes nodePulse {
		0%,
		100% {
			opacity: 0.4;
			transform: scale(1);
		}
		50% {
			opacity: 0.8;
			transform: scale(1.2);
		}
	}

	@keyframes nodeRing {
		0% {
			transform: scale(1);
			opacity: 0.4;
		}
		100% {
			transform: scale(4);
			opacity: 0;
		}
	}

	.node-1 {
		top: 15%;
		left: 20%;
	}
	.node-2 {
		top: 30%;
		right: 25%;
		animation-delay: 0.5s;
	}
	.node-3 {
		bottom: 35%;
		left: 15%;
		animation-delay: 1s;
	}
	.node-4 {
		bottom: 20%;
		right: 20%;
		animation-delay: 1.5s;
	}
	.node-5 {
		top: 50%;
		left: 35%;
		animation-delay: 2s;
	}
	.node-6 {
		top: 70%;
		right: 35%;
		animation-delay: 2.5s;
	}

	.spinner {
		width: 18px;
		height: 18px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
