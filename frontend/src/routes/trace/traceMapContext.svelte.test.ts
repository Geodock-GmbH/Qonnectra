import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('svelte', () => {
	const contextStore = new Map();
	return {
		getContext: vi.fn((key) => contextStore.get(key)),
		setContext: vi.fn((key, value) => contextStore.set(key, value))
	};
});

const { createTraceMapContext, getTraceMapContext } = await import('./traceMapContext.svelte.js');
const { setContext } = await import('svelte');

describe('traceMapContext', () => {
	let ctx: ReturnType<typeof createTraceMapContext>;

	beforeEach(() => {
		vi.clearAllMocks();
		ctx = createTraceMapContext();
	});

	describe('createTraceMapContext', () => {
		test('should register the context via setContext', () => {
			expect(setContext).toHaveBeenCalledOnce();
			expect(setContext).toHaveBeenCalledWith(expect.any(Symbol), ctx);
		});

		test('should initialize traceResult to null', () => {
			expect(ctx.traceResult).toBeNull();
		});

		test('should initialize includeGeometry to false', () => {
			expect(ctx.includeGeometry).toBe(false);
		});

		test('should initialize selectedFeatureId to null', () => {
			expect(ctx.selectedFeatureId).toBeNull();
		});
	});

	describe('traceResult', () => {
		test('should be writable and readable', () => {
			const result = { path: ['a', 'b'], features: [] } as never;
			ctx.traceResult = result;
			expect(ctx.traceResult).toEqual(result);
		});

		test('should accept null to clear', () => {
			ctx.traceResult = { path: [] } as never;
			ctx.traceResult = null;
			expect(ctx.traceResult).toBeNull();
		});
	});

	describe('includeGeometry', () => {
		test('should toggle between true and false', () => {
			ctx.includeGeometry = true;
			expect(ctx.includeGeometry).toBe(true);

			ctx.includeGeometry = false;
			expect(ctx.includeGeometry).toBe(false);
		});
	});

	describe('setSelectedFeature', () => {
		test('should set the selected feature id', () => {
			ctx.setSelectedFeature('feature-42');
			expect(ctx.selectedFeatureId).toBe('feature-42');
		});

		test('should accept null to deselect', () => {
			ctx.setSelectedFeature('feature-1');
			ctx.setSelectedFeature(null);
			expect(ctx.selectedFeatureId).toBeNull();
		});
	});

	describe('getTraceMapContext', () => {
		test('should return the context registered by createTraceMapContext', () => {
			const retrieved = getTraceMapContext();
			expect(retrieved).toBe(ctx);
		});
	});
});
