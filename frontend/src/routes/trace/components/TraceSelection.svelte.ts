import { createContext } from 'svelte';

/**
 * The entity highlighted on a trace page, shared by the result lists and the
 * map so a click in either one marks it in both.
 */
export class TraceSelection {
	/** `type:uuid` of the highlighted entity, matching the map's feature ids. */
	featureId = $state<string | null>(null);

	/**
	 * Highlights an entity picked in a result list.
	 * @param type - Entity type, e.g. `cable` or `node`.
	 * @param id - Entity UUID.
	 */
	selectItem = (type: string, id: string): void => {
		this.featureId = `${type}:${id}`;
	};

	/**
	 * Highlights a feature clicked on the map.
	 * @param featureId - The feature's `type:uuid` id, or `null` for a click on empty map.
	 */
	selectFeature = (featureId: string | null): void => {
		this.featureId = featureId;
	};
}

export const [getTraceSelection, setTraceSelection] = createContext<TraceSelection>();
