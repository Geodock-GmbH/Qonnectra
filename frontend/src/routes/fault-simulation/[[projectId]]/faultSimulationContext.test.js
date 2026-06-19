import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('svelte', () => {
	const contextStore = new Map();
	return {
		getContext: vi.fn((key) => contextStore.get(key)),
		setContext: vi.fn((key, value) => contextStore.set(key, value))
	};
});

const { createFaultSimulationContext, getFaultSimulationContext } =
	await import('./faultSimulationContext.svelte.js');
const { setContext, getContext } = await import('svelte');

describe('faultSimulationContext', () => {
	/** @type {ReturnType<typeof createFaultSimulationContext>} */
	let ctx;

	beforeEach(() => {
		vi.clearAllMocks();
		ctx = createFaultSimulationContext();
	});

	describe('createFaultSimulationContext', () => {
		test('should register context via setContext', () => {
			expect(setContext).toHaveBeenCalledOnce();
			expect(setContext).toHaveBeenCalledWith(expect.any(Symbol), ctx);
		});

		test('should initialize with null damagePoint', () => {
			expect(ctx.damagePoint).toBeNull();
		});

		test('should initialize with null selectedTrench', () => {
			expect(ctx.selectedTrench).toBeNull();
		});

		test('should initialize with null simulationResult', () => {
			expect(ctx.simulationResult).toBeNull();
		});

		test('should initialize with isSimulating false', () => {
			expect(ctx.isSimulating).toBe(false);
		});

		test('should initialize with null selectedCableId', () => {
			expect(ctx.selectedCableId).toBeNull();
		});
	});

	describe('setDamagePoint', () => {
		test('should set damage point and trench', () => {
			const point = /** @type {[number, number]} */ ([100, 200]);
			const trench = { id_trench: 'T-001', construction_type: 'open', uuid: 'trench-uuid' };

			ctx.setDamagePoint(point, trench);

			expect(ctx.damagePoint).toEqual([100, 200]);
			expect(ctx.selectedTrench).toEqual(trench);
		});

		test('should reset simulationResult when setting new damage point', () => {
			ctx.setSimulationResult({ summary: { total: 5 } });
			ctx.setDamagePoint([100, 200], { id_trench: 'T-002' });

			expect(ctx.simulationResult).toBeNull();
		});

		test('should reset selectedCableId when setting new damage point', () => {
			ctx.setSelectedCable('cable-uuid');
			ctx.setDamagePoint([100, 200], { id_trench: 'T-002' });

			expect(ctx.selectedCableId).toBeNull();
		});

		test('should accept null values to clear damage point', () => {
			ctx.setDamagePoint([100, 200], { id_trench: 'T-001' });
			ctx.setDamagePoint(null, null);

			expect(ctx.damagePoint).toBeNull();
			expect(ctx.selectedTrench).toBeNull();
		});
	});

	describe('setSimulationResult', () => {
		test('should set the simulation result', () => {
			const result = {
				summary: { total_cables_affected: 3 },
				conduits: [{ uuid: 'c-1' }],
				cables: [{ uuid: 'cable-1' }]
			};

			ctx.setSimulationResult(result);

			expect(ctx.simulationResult).toEqual(result);
		});

		test('should accept null to clear simulation result', () => {
			ctx.setSimulationResult({ summary: {} });
			ctx.setSimulationResult(null);

			expect(ctx.simulationResult).toBeNull();
		});
	});

	describe('setSelectedCable', () => {
		test('should set the selected cable id', () => {
			ctx.setSelectedCable('cable-uuid-123');

			expect(ctx.selectedCableId).toBe('cable-uuid-123');
		});

		test('should accept null to deselect cable', () => {
			ctx.setSelectedCable('cable-uuid');
			ctx.setSelectedCable(null);

			expect(ctx.selectedCableId).toBeNull();
		});
	});

	describe('isSimulating', () => {
		test('should be writable', () => {
			ctx.isSimulating = true;
			expect(ctx.isSimulating).toBe(true);

			ctx.isSimulating = false;
			expect(ctx.isSimulating).toBe(false);
		});
	});

	describe('reset', () => {
		test('should reset all state to initial values', () => {
			ctx.setDamagePoint([100, 200], { id_trench: 'T-001' });
			ctx.setSimulationResult({ summary: {} });
			ctx.isSimulating = true;
			ctx.setSelectedCable('cable-uuid');

			ctx.reset();

			expect(ctx.damagePoint).toBeNull();
			expect(ctx.selectedTrench).toBeNull();
			expect(ctx.simulationResult).toBeNull();
			expect(ctx.isSimulating).toBe(false);
			expect(ctx.selectedCableId).toBeNull();
		});

		test('should be callable multiple times without error', () => {
			ctx.reset();
			ctx.reset();

			expect(ctx.damagePoint).toBeNull();
		});
	});

	describe('getFaultSimulationContext', () => {
		test('should return the context set by createFaultSimulationContext', () => {
			const retrieved = getFaultSimulationContext();
			expect(retrieved).toBe(ctx);
		});
	});
});
