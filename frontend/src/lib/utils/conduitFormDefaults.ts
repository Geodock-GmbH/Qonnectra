const STORAGE_KEY = 'conduit-form-defaults';

/**
 * The create-conduit form values remembered between creations. Selection
 * fields hold the combobox's value arrays: bare id strings, not option objects.
 */
export interface ConduitFormDefaults {
	conduitName: string;
	outerConduit: string;
	conduitType: string[];
	status: string[];
	networkLevel: string[];
	owner: string[];
	constructor: string[];
	manufacturer: string[];
	date: string;
	flag: string[];
}

/**
 * A fresh, empty set of form values.
 * @returns Empty defaults with blank strings and empty selection arrays.
 */
export function emptyConduitFormDefaults(): ConduitFormDefaults {
	return {
		conduitName: '',
		outerConduit: '',
		conduitType: [],
		status: [],
		networkLevel: [],
		owner: [],
		constructor: [],
		manufacturer: [],
		date: '',
		flag: []
	};
}

/**
 * Reads the remembered form values from localStorage, falling back to empty
 * values when nothing is stored, storage is unavailable or the entry is
 * malformed.
 * @returns The remembered form values, or empty defaults.
 */
export function loadConduitFormDefaults(): ConduitFormDefaults {
	const defaults = emptyConduitFormDefaults();
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return defaults;
		const parsed = JSON.parse(stored) as Record<string, unknown>;
		// Keys are read as own properties: a missing `constructor` would
		// otherwise resolve to `Object` from the prototype.
		const text = (key: keyof ConduitFormDefaults) =>
			Object.hasOwn(parsed, key) && typeof parsed[key] === 'string' ? (parsed[key] as string) : '';
		const list = (key: keyof ConduitFormDefaults) =>
			Object.hasOwn(parsed, key) && Array.isArray(parsed[key])
				? (parsed[key] as unknown[]).map(String)
				: [];
		return {
			conduitName: text('conduitName'),
			outerConduit: text('outerConduit'),
			conduitType: list('conduitType'),
			status: list('status'),
			networkLevel: list('networkLevel'),
			owner: list('owner'),
			constructor: list('constructor'),
			manufacturer: list('manufacturer'),
			date: text('date'),
			flag: list('flag')
		};
	} catch {
		return defaults;
	}
}

/**
 * Remembers the given form values for the next creation. Storage failures
 * (quota, private mode) are ignored.
 * @param values - The values to remember.
 */
export function saveConduitFormDefaults(values: ConduitFormDefaults): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
	} catch {
		return;
	}
}
