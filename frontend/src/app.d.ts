declare global {
	namespace App {
		interface Locals {
			user: import('$lib/stores/auth').UserData;
		}

		interface PageState {
			/** Valuation selection that is page-only, not in the URL; gone on reload. */
			valuation?: {
				/** Areas mode entered without a pick yet. */
				pickingAreas?: boolean;
				/** A selection too long for the URL. */
				localAreas?: string[];
			};
		}
	}
}

export {};
