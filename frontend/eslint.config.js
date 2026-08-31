import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';

/**
 * Minimal flat ESLint config enforcing the `any` ban.
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
			'@typescript-eslint/no-explicit-any': 'error'
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
