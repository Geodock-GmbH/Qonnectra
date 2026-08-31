import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';

/**
 * Minimal flat ESLint config enforcing the `any` ban.
 *
 * `@typescript-eslint/no-explicit-any` is an ERROR: the 2026-08 burndown took
 * production `any` from 568 to 0 (plus 3 justified, eslint-disabled cases with
 * inline rationale — GenericCombobox's polymorphic `data`, NodeStructurePanel's
 * string↔boolean `activeSheet`, the trench-page OL `on('click')` cast). Any new
 * `any` needs the same disable-with-rationale treatment or a real type.
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
