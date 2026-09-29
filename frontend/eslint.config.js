import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';

/**
 * Flat ESLint config: the typescript-eslint and Svelte recommended rules, plus
 * the `any` ban, typed navigation and the `$app/state` runes over the legacy
 * `$app/stores`. Unused names prefixed with `_` are allowed (omitted rest keys,
 * dependency reads in effects). `.svelte` and `.svelte.ts` files are parsed as
 * TypeScript.
 *
 * ```
 * npm run lint:ts
 * ```
 *
 * Generated, vendored and test files are ignored so the rule targets
 * production code.
 */
export default tseslint.config(
	{
		ignores: [
			'src/lib/paraglide/**',
			'src/lib/types/api.d.ts',
			'**/*.test.ts',
			'**/*.spec.ts',
			'**/test-utils/**',
			'**/mocks/**',
			'.svelte-kit/**',
			'build/**'
		]
	},
	...tseslint.configs.recommended,
	...svelte.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				projectService: false,
				extraFileExtensions: ['.svelte']
			}
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
			],
			'svelte/no-navigation-without-resolve': 'error',
			// Runes read `page` from `$app/state`; the store form is legacy.
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: '$app/stores',
							message: 'Use `$app/state` (page, navigating, updated) instead of the legacy stores.'
						}
					]
				}
			]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser
			}
		}
	}
);
