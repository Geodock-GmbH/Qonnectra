<script>
	import { deserialize } from '$app/forms';

	import { m } from '$lib/paraglide/messages';

	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';

	let cable = $derived($drawerStore.props);
	let handleStart = $derived(cable?.handle_start || 'top');
	let handleEnd = $derived(cable?.handle_end || 'top');

	$effect(() => {
		if (cable) {
			handleStart = cable.handle_start || 'top';
			handleEnd = cable.handle_end || 'top';
		}
	});

	const handleOptions = [
		{ label: m.from_top(), value: 'top' },
		{ label: m.form_right(), value: 'right' },
		{ label: m.form_bottom(), value: 'bottom' },
		{ label: m.form_left(), value: 'left' }
	];

	async function handleSubmit(event) {
		event.preventDefault();
		const formData = new FormData();
		formData.append('uuid', cable.uuid);
		formData.append('handle_start', handleStart);
		formData.append('handle_end', handleEnd);

		try {
			const response = await fetch('?/updateCable', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure') {
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_updating_cable()
				});
				return;
			}

			if (result.type === 'error') {
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_updating_cable()
				});
				return;
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_cable()
			});

			window.dispatchEvent(
				new CustomEvent('updateCableHandles', {
					detail: {
						cableId: cable.uuid,
						handleStart: handleStart,
						handleEnd: handleEnd
					}
				})
			);
		} catch (error) {
			console.error('Error updating cable handles:', error);
			globalToaster.error({
				title: m.message_error_updating_cable()
			});
		}
	}
</script>

<!-- Handle configuration form -->
<form id="handle-config-form" class="flex flex-col gap-6" onsubmit={handleSubmit}>
	<!-- Start Node -->
	<div class="space-y-3">
		<h3 class="text-lg font-semibold">
			{cable?.uuid_node_start_name || cable?.uuid_node_start || 'Unknown'}
		</h3>
		<div class="space-y-2">
			<div class="space-y-2">
				{#each handleOptions as option}
					<label class="flex items-center space-x-2">
						<input
							class="radio"
							type="radio"
							name="handle-start"
							value={option.value}
							checked={handleStart === option.value}
							onchange={() => (handleStart = option.value)}
						/>
						<p class="text-sm">{option.label}</p>
					</label>
				{/each}
			</div>
		</div>
	</div>

	<!-- End Node -->
	<div class="space-y-3">
		<h3 class="text-lg font-semibold">
			{cable?.uuid_node_end_name || cable?.uuid_node_end || 'Unknown'}
		</h3>
		<div class="space-y-2">
			<div class="space-y-2">
				{#each handleOptions as option}
					<label class="flex items-center space-x-2">
						<input
							class="radio"
							type="radio"
							name="handle-end"
							value={option.value}
							checked={handleEnd === option.value}
							onchange={() => (handleEnd = option.value)}
						/>
						<p>{option.label}</p>
					</label>
				{/each}
			</div>
		</div>
	</div>
</form>

<!-- Save button -->
<div class="mt-6 flex flex-col items-end justify-end gap-3">
	<button type="submit" form="handle-config-form" class="btn preset-filled-primary-500 w-full">
		{m.action_save()}
	</button>
</div>
