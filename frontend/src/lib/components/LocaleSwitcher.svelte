<script>
	// Svelte
	import { browser } from '$app/environment';
	// Paraglide
	import { getLocale, setLocale } from '$lib/paraglide/runtime';
	import GenericCombobox from './GenericCombobox.svelte';

	const locales = [
		{ label: 'DE', value: 'de' },
		{ label: 'EN', value: 'en' }
	];

	let currentLocale = $state([getLocale()]);

	function handleLocaleChange(e) {
		if (browser && e.value !== currentLocale) {
			setLocale([e.value]);
			currentLocale = [e.value];
		}
	}
</script>

<GenericCombobox
	data={locales}
	bind:value={currentLocale}
	defaultValue={currentLocale}
	onValueChange={handleLocaleChange}
	placeholder="Language"
	classes="touch-manipulation w-28"
	contentBase="max-h-60 overflow-auto touch-manipulation rounded-md border border-surface-200-800 bg-surface-50-950 shadow-lg"
/>
