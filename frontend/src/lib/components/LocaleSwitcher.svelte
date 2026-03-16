<script>
	import { browser } from '$app/environment';

	import { m } from '$lib/paraglide/messages';
	import { getLocale, setLocale } from '$lib/paraglide/runtime';

	import GenericCombobox from './GenericCombobox.svelte';

	const locales = [
		{ label: 'DE', value: 'de' },
		{ label: 'EN', value: 'en' }
	];

	let currentLocale = $state([getLocale()]);

	function handleLocaleChange(/** @type {{ value: string[] }} */ e) {
		const newLocale = e.value[0];
		if (browser && newLocale && newLocale !== getLocale()) {
			setLocale(/** @type {"de" | "en"} */ (newLocale));
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
