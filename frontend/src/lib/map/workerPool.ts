import type { SerializedFeature } from './featureReconstructor';

interface ParseResult {
	success: boolean;
	features?: SerializedFeature[];
	error?: string;
}

interface PendingRequest {
	resolve: (result: ParseResult) => void;
}

/**
 * Pool of Web Workers for parallel MVT parsing.
 * Distributes work via round-robin and handles responses.
 */
export class WorkerPool {
	workers: Worker[];
	pendingRequests: Map<string, PendingRequest>;
	currentWorkerIndex: number;

	constructor(size = 2) {
		this.workers = [];
		this.pendingRequests = new Map();
		this.currentWorkerIndex = 0;

		// Only create workers in browser environment
		if (typeof Worker !== 'undefined') {
			for (let i = 0; i < size; i++) {
				const worker = new Worker(new URL('./mvtParserWorker.js', import.meta.url), {
					type: 'module'
				});
				worker.onmessage = this.handleWorkerMessage.bind(this);
				this.workers.push(worker);
			}
		}
	}

	/** Handle message from worker */
	handleWorkerMessage(event: MessageEvent): void {
		const { requestId, success, features, error } = event.data;
		const pending = this.pendingRequests.get(requestId);

		if (pending) {
			this.pendingRequests.delete(requestId);
			pending.resolve({ success, features, error });
		}
	}

	/** Parse MVT data using a worker */
	parse(
		requestId: string,
		data: ArrayBuffer,
		extent: number[],
		projection: string
	): Promise<ParseResult> {
		return new Promise((resolve) => {
			if (this.workers.length === 0) {
				// Fallback: no workers available (SSR)
				resolve({ success: false, error: 'Workers not available' });
				return;
			}

			this.pendingRequests.set(requestId, { resolve });

			const worker = this.workers[this.currentWorkerIndex];
			this.currentWorkerIndex = (this.currentWorkerIndex + 1) % this.workers.length;

			// Note: We don't transfer the ArrayBuffer (no transferList) to allow
			// fallback parsing on the main thread if the worker fails
			worker.postMessage({ requestId, data, extent, projection });
		});
	}

	/** Cancel a pending request */
	cancelRequest(requestId: string): void {
		const pending = this.pendingRequests.get(requestId);
		if (pending) {
			this.pendingRequests.delete(requestId);
			pending.resolve({ success: false, error: 'Cancelled' });
		}
	}

	/** Cancel all pending requests */
	cancelAllRequests(): void {
		for (const [, pending] of this.pendingRequests) {
			pending.resolve({ success: false, error: 'Cancelled' });
		}
		this.pendingRequests.clear();
	}

	/** Terminate all workers */
	destroy(): void {
		this.cancelAllRequests();
		for (const worker of this.workers) {
			worker.terminate();
		}
		this.workers = [];
	}
}

let workerPoolInstance: WorkerPool | null = null;

/** Get or create the worker pool singleton */
export function getWorkerPool(): WorkerPool {
	if (!workerPoolInstance) {
		const poolSize =
			typeof navigator !== 'undefined' && navigator.hardwareConcurrency
				? Math.min(navigator.hardwareConcurrency, 4)
				: 2;
		workerPoolInstance = new WorkerPool(poolSize);
	}
	return workerPoolInstance;
}

/** Destroy the worker pool singleton */
export function destroyWorkerPool(): void {
	if (workerPoolInstance) {
		workerPoolInstance.destroy();
		workerPoolInstance = null;
	}
}
