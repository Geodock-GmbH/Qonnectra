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

	/** @type {{ form: import('./$types').ActionData }} */
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
	<!-- Left Panel - Topographic Map Design (desktop only) -->
	<div
		class="login-hero relative hidden flex-1 items-center justify-center overflow-hidden lg:flex"
	>
		<!-- Subtle grid -->
		<div class="topo-grid absolute inset-0"></div>

		<!-- Flowing contour lines -->
		<svg
			class="topo-flow absolute inset-0 h-full w-full"
			viewBox="0 0 800 800"
			preserveAspectRatio="xMidYMid slice"
		>
			<path
				class="contour"
				d="M-50,150 Q150,80 350,180 Q550,280 750,150 L850,150"
				fill="none"
				stroke="rgba(255,255,255,0.12)"
				stroke-width="1"
			/>
			<path
				class="contour"
				d="M-50,220 Q180,140 380,240 Q580,340 780,200 L850,200"
				fill="none"
				stroke="rgba(255,255,255,0.18)"
				stroke-width="1"
			/>
			<path
				class="contour"
				d="M-50,290 Q200,200 400,300 Q600,400 800,260 L850,260"
				fill="none"
				stroke="rgba(255,255,255,0.1)"
				stroke-width="1"
			/>
			<path
				class="contour"
				d="M-50,380 Q180,300 400,400 Q620,500 820,360 L850,360"
				fill="none"
				stroke="rgba(255,255,255,0.15)"
				stroke-width="1"
			/>
			<path
				class="contour"
				d="M-50,460 Q200,380 420,480 Q640,580 840,440 L850,440"
				fill="none"
				stroke="rgba(255,255,255,0.2)"
				stroke-width="1"
			/>
			<path
				class="contour"
				d="M-50,540 Q220,460 440,560 Q660,660 850,520 L850,520"
				fill="none"
				stroke="rgba(255,255,255,0.12)"
				stroke-width="1"
			/>
			<path
				class="contour"
				d="M-50,620 Q240,540 460,640 Q680,740 850,600 L850,600"
				fill="none"
				stroke="rgba(255,255,255,0.16)"
				stroke-width="1"
			/>
			<path
				class="contour"
				d="M-50,700 Q260,620 480,720 Q700,820 850,680 L850,680"
				fill="none"
				stroke="rgba(255,255,255,0.1)"
				stroke-width="1"
			/>
		</svg>

		<!-- Content -->
		<div class="relative z-10 flex flex-col items-center p-8 text-center text-white">
			<div
				class="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/95 shadow-lg backdrop-blur-sm"
			>
				<AppIcon size="3rem" color="var(--color-primary-600)" />
			</div>
			<h1 class="mt-4 text-4xl font-bold tracking-tight">Qonnectra</h1>
			<p class="mt-3 text-lg opacity-85">
				{m.login_tagline?.()}
			</p>
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
			160deg,
			var(--color-primary-700) 0%,
			var(--color-primary-600) 50%,
			var(--color-primary-500) 100%
		);
	}

	.topo-grid {
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
		background-size: 40px 40px;
	}

	.contour {
		opacity: 0.8;
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
