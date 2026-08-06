import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ConduitState } from './ConduitState.svelte';

const STORAGE_KEY = 'conduit-form-defaults';

const rawConduit = {
	uuid: 'c1',
	name: 'DA 50 Nord',
	conduit_type: { conduit_type: 'DA 50' },
	outer_conduit: null,
	status: { status: 'verlegt' },
	network_level: { network_level: 'NE3' },
	owner: { company: 'Stadtwerke' },
	constructor: { company: 'Baufirma' },
	manufacturer: { company: 'Hersteller' },
	date: '2026-01-01',
	flag: { flag: 'Bau' }
};

const formattedConduit = {
	value: 'c1',
	name: 'DA 50 Nord',
	conduit_type: 'DA 50',
	outer_conduit: null,
	status: 'verlegt',
	network_level: 'NE3',
	owner: 'Stadtwerke',
	constructor: 'Baufirma',
	manufacturer: 'Hersteller',
	date: '2026-01-01',
	flag: 'Bau'
};

beforeEach(() => {
	localStorage.clear();
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('ConduitState', () => {
	test('should initialize with pipes from the load function', () => {
		const state = new ConduitState({ pipes: [formattedConduit] });

		expect(state.conduits).toEqual([formattedConduit]);
	});

	test('should format raw API conduits for table display', () => {
		const state = new ConduitState({});

		expect(state.formatConduit(rawConduit)).toEqual(formattedConduit);
	});

	test('should default missing nested fields to empty strings', () => {
		const state = new ConduitState({});

		const result = state.formatConduit({
			uuid: 'c2',
			name: 'Leer'
		} as unknown as Parameters<typeof state.formatConduit>[0]);

		expect(result.conduit_type).toBe('');
		expect(result.status).toBe('');
		expect(result.owner).toBe('');
		expect(result.constructor).toBe('');
		expect(result.flag).toBe('');
	});

	test('should update a conduit in place', () => {
		const state = new ConduitState({ pipes: [formattedConduit] });

		state.updateConduit({ ...rawConduit, name: 'Umbenannt' });

		expect(state.conduits[0].name).toBe('Umbenannt');
		expect(state.conduits).toHaveLength(1);
	});

	test('should ignore updates for unknown conduits', () => {
		const state = new ConduitState({ pipes: [formattedConduit] });

		state.updateConduit({
			uuid: 'unknown',
			name: 'X'
		} as unknown as Parameters<typeof state.updateConduit>[0]);

		expect(state.conduits).toEqual([formattedConduit]);
	});

	test('should prepend new conduits', () => {
		const state = new ConduitState({ pipes: [formattedConduit] });

		state.addConduit({
			uuid: 'c2',
			name: 'Neu'
		} as unknown as Parameters<typeof state.addConduit>[0]);

		expect(state.conduits[0].value).toBe('c2');
		expect(state.conduits).toHaveLength(2);
	});

	test('should delete a conduit by id', () => {
		const state = new ConduitState({ pipes: [formattedConduit] });

		state.deleteConduit('c1');

		expect(state.conduits).toEqual([]);
	});

	test('should replace conduits via setConduits', () => {
		const state = new ConduitState({ pipes: [formattedConduit] });

		state.setConduits([]);

		expect(state.conduits).toEqual([]);
	});
});

describe('form defaults persistence', () => {
	const defaults = {
		conduitName: 'DA 50',
		outerConduit: 'outer-1',
		conduitType: [{ value: 't1', label: 'DA 50' }],
		status: [{ value: 's1', label: 'verlegt' }],
		networkLevel: [],
		owner: [],
		constructor: [],
		manufacturer: [],
		date: '2026-01-01',
		flag: []
	};

	test('should persist defaults to localStorage', () => {
		const state = new ConduitState({});

		state.setDefaults(defaults);

		expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(defaults);
		expect(state.getDefaults()).toEqual(defaults);
	});

	test('should load persisted defaults on construction', () => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));

		const state = new ConduitState({});

		expect(state.getDefaults()).toEqual(defaults);
	});

	test('should fall back to empty defaults for malformed stored JSON', () => {
		localStorage.setItem(STORAGE_KEY, '{broken');

		const state = new ConduitState({});

		expect(state.getDefaults().conduitName).toBe('');
		expect(console.warn).toHaveBeenCalled();
	});
});
