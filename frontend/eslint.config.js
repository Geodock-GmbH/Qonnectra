import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';

/**
 * Minimal flat ESLint config for the `any`-elimination metric.
 *
 * Its job right now is to surface `@typescript-eslint/no-explicit-any` as a
 * WARNING (not an error — CI must not break) across `.ts` and `.svelte`
 * sources, so the burndown has a machine-countable signal:
 *
 * ```
 * npm run lint:ts
 * ```
 *
 * Generated, vendored and test files are ignored so the count reflects
 * production code we intend to type. Flip the rule to `'error'` only once the
 * residual count is all justified (see plan task C8).
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
			'@typescript-eslint/no-explicit-any': 'warn'
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser
			}
		}
	}
);
