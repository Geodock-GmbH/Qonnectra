<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';
	import { loadUserSettings, saveUserSettings } from '$lib/utils/userSettingsSync';

	/** Whether a save or load request to the server is currently in flight. */
	let syncing = $state(false);

	/** Saves the current browser settings to the server, overwriting previous saves. */
	async function handleSaveSettings() {
		syncing = true;
		try {
			await saveUserSettings();
			globalToaster.create({ title: m.settings_sync_save_success(), type: 'success' });
		} catch {
			globalToaster.create({ title: m.settings_sync_save_error(), type: 'error' });
		} finally {
			syncing = false;
		}
	}

	/** Loads saved settings from the server into this browser, then reloads to apply them. */
	async function handleLoadSettings() {
		syncing = true;
		try {
			await loadUserSettings();
			location.reload();
		} catch {
			globalToaster.create({ title: m.settings_sync_load_error(), type: 'error' });
			syncing = false;
		}
	}
</script>

<div class="flex flex-wrap gap-3">
	<button
		type="button"
		class="btn preset-filled-primary-500"
		disabled={syncing}
		onclick={handleSaveSettings}
	>
		{m.settings_sync_save()}
	</button>
	<button
		type="button"
		class="btn preset-tonal-surface"
		disabled={syncing}
		onclick={handleLoadSettings}
	>
		{m.settings_sync_load()}
	</button>
</div>
