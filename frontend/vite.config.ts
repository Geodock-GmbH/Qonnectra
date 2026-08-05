import { sveltekit } from '@sveltejs/kit/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const plugins: any[] = [
	tailwindcss(),
	sveltekit(),
	paraglideVitePlugin({
		project: './project.inlang',
		outdir: './src/lib/paraglide',
		strategy: ['localStorage', 'baseLocale']
	})
];

export default defineConfig({
	plugins,
	optimizeDeps: {
		exclude: ['ol']
	},
	test: {
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			include: ['src/**/*.{js,ts,svelte}'],
			exclude: [
				'src/**/*.{test,spec}.{js,ts}',
				'src/lib/test-utils/**',
				'src/lib/paraglide/**',
				'src/paraglide/**',
				'src/**/*.d.ts',
				'src/service-worker.ts'
			]
		},
		projects: [
			{
				extends: true,
				plugins: [svelteTesting() as any],
				test: {
					name: 'client',
					environment: 'jsdom',
					clearMocks: true,
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.js']
				}
			},
			{
				extends: true,
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	},
	resolve: process.env.VITEST
		? {
				conditions: ['browser']
			}
		: undefined
});
