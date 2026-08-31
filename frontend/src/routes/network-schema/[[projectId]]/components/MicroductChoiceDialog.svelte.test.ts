import type { NetworkSchemaState } from '$lib/classes/NetworkSchemaState.svelte';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import MicroductChoiceDialog from './MicroductChoiceDialog.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get:
				(_target, prop: string) =>
				(args: Record<string, unknown> = {}) =>
					Object.keys(args).length ? `${prop}:${JSON.stringify(args)}` : `${prop}`
		}
	)
}));

function makeCandidate(overrides: Record<string, unknown> = {}) {
	return {
		microduct_uuid: 'md-1',
		conduit_name: 'C-1',
		number: 3,
		color: 'blau',
		color_hex: '#0000ff',
		linked_cables: [],
		...overrides
	};
}

function makeSchemaState(choices: unknown[]) {
	return {
		pendingMicroductChoices: choices,
		chooseMicroduct: vi.fn(),
		dismissMicroductChoice: vi.fn()
	};
}

afterEach(() => {
	vi.clearAllMocks();
});

describe('MicroductChoiceDialog', () => {
	test('should not render candidate content when there is no pending choice', () => {
		const schemaState = makeSchemaState([]);

		render(MicroductChoiceDialog, {
			schemaState: schemaState as unknown as NetworkSchemaState
		});

		expect(
			screen.queryByText(
				'message_micropipe_choice_dialog:{"address":"Hauptstr. 1","cable":"K-Nord"}'
			)
		).not.toBeInTheDocument();
		expect(screen.queryByText(/C-1 · #3/)).not.toBeInTheDocument();
	});

	test('should render the title, message and one button per candidate when a choice is pending', () => {
		const schemaState = makeSchemaState([
			{
				address: 'Hauptstr. 1',
				cableName: 'K-Nord',
				candidates: [
					makeCandidate({ microduct_uuid: 'md-1', conduit_name: 'C-1', number: 3 }),
					makeCandidate({ microduct_uuid: 'md-2', conduit_name: 'C-2', number: 7 })
				]
			}
		]);

		render(MicroductChoiceDialog, {
			schemaState: schemaState as unknown as NetworkSchemaState
		});

		expect(screen.getByText('title_micropipe_choice_dialog')).toBeInTheDocument();
		expect(
			screen.getByText('message_micropipe_choice_dialog:{"address":"Hauptstr. 1","cable":"K-Nord"}')
		).toBeInTheDocument();
		expect(screen.getByText(/C-1 · #3 blau/)).toBeInTheDocument();
		expect(screen.getByText(/C-2 · #7 blau/)).toBeInTheDocument();
	});

	test('should render linked cable names when the candidate has linked cables', () => {
		const schemaState = makeSchemaState([
			{
				address: 'Hauptstr. 1',
				cableName: 'K-Nord',
				candidates: [
					makeCandidate({
						linked_cables: [{ name: 'Cable-A' }, { name: 'Cable-B' }]
					})
				]
			}
		]);

		render(MicroductChoiceDialog, {
			schemaState: schemaState as unknown as NetworkSchemaState
		});

		expect(screen.getByText(/Cable-A, Cable-B/)).toBeInTheDocument();
	});

	test('should call chooseMicroduct with the candidate uuid when its button is clicked', async () => {
		const user = userEvent.setup();
		const schemaState = makeSchemaState([
			{
				address: 'Hauptstr. 1',
				cableName: 'K-Nord',
				candidates: [makeCandidate({ microduct_uuid: 'md-2' })]
			}
		]);

		render(MicroductChoiceDialog, {
			schemaState: schemaState as unknown as NetworkSchemaState
		});

		await user.click(screen.getByText(/C-1 · #3 blau/));

		expect(schemaState.chooseMicroduct).toHaveBeenCalledWith('md-2');
		expect(schemaState.dismissMicroductChoice).not.toHaveBeenCalled();
	});

	test('should call dismissMicroductChoice when the cancel button is clicked', async () => {
		const user = userEvent.setup();
		const schemaState = makeSchemaState([
			{
				address: 'Hauptstr. 1',
				cableName: 'K-Nord',
				candidates: [makeCandidate()]
			}
		]);

		render(MicroductChoiceDialog, {
			schemaState: schemaState as unknown as NetworkSchemaState
		});

		await user.click(screen.getByText('common_cancel'));

		expect(schemaState.dismissMicroductChoice).toHaveBeenCalledTimes(1);
		expect(schemaState.chooseMicroduct).not.toHaveBeenCalled();
	});
});
