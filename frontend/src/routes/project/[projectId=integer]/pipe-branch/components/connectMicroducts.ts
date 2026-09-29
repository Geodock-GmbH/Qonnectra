import type { MicroductPair } from '$lib/remote/pipe-branch/connection-data';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';
import { logToBackendClient } from '$lib/utils/logToBackendClient';
import { createConnections, getConnections } from '$lib/remote/pipe-branch/connections.remote';
import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

/**
 * Connects microduct pairs at a pipe-branch node and reports the outcome as
 * toasts. The pairs show up as pending connections until the backend answers.
 * @param nodeUuid - Pipe-branch node the microducts are joined at.
 * @param pairs - The microduct pairs to connect.
 */
export async function connectMicroducts(nodeUuid: string, pairs: MicroductPair[]): Promise<void> {
	const isBatch = pairs.length > 1;

	try {
		const { created, errors } = await createConnections({ nodeUuid, pairs }).updates(
			getConnections(nodeUuid).withOverride((saved) => [
				...saved,
				...pairs.map((pair) => ({ uuid: null, ...pair }))
			])
		);

		if (created > 0) {
			globalToaster.success({
				title: m.title_success(),
				description: isBatch
					? `${created}x ${m.message_created_connections()}`
					: m.message_success_creating_connection()
			});
		}

		if (errors.length > 0) {
			globalToaster.error({
				title: m.common_error(),
				description: isBatch
					? `${errors.length}x ${m.message_failed_to_create_connections()}`
					: (errors[0] ?? m.message_error_creating_connection())
			});
		}
	} catch (error) {
		void logToBackendClient({
			level: 'ERROR',
			message: 'Error creating connections',
			extraData: {
				from: 'connectMicroducts',
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined
			}
		});
		globalToaster.error({
			title: m.common_error(),
			description:
				remoteErrorMessage(error) ??
				(isBatch ? m.message_failed_to_create_connections() : m.message_error_creating_connection())
		});
	}
}
