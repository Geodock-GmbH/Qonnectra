<script lang="ts">
	import { browser } from '$app/environment';

	import { m } from '$lib/paraglide/messages';
	import { getLocale, setLocale } from '$lib/paraglide/runtime';

	import GenericCombobox from './GenericCombobox.svelte';

	const locales = [
		{ label: 'DE', value: 'de' },
		{ label: 'EN', value: 'en' }
	];

	let currentLocale = $state<string[]>([getLocale()]);

	function handleLocaleChange(e: { value: string[] }) {
		const newLocale = e.value[0];
		if (browser && newLocale && newLocale !== getLocale()) {
			setLocale(newLocale as 'de' | 'en');
		}
	}
</script>

<GenericCombobox
	data={locales}
	bind:value={currentLocale}
	defaultValue={currentLocale}
	onValueChange={handleLocaleChange}
	placeholder={m.common_language()}
	classes="touch-manipulation w-28"
	contentBase="max-h-60 overflow-auto touch-manipulation rounded-md border border-surface-200-800 bg-surface-50-950 shadow-lg z-50"
/>
