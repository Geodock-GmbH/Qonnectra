import type { InquiryPolygon } from './inquiryContext.svelte.js';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('svelte', () => {
	const contextStore = new Map();
	return {
		getContext: vi.fn((key) => contextStore.get(key)),
		setContext: vi.fn((key, value) => contextStore.set(key, value))
	};
});

const { createInquiryContext, getInquiryContext } = await import('./inquiryContext.svelte.js');
const { setContext } = await import('svelte');

function makePolygon(overrides: Partial<InquiryPolygon> = {}): InquiryPolygon {
	return {
		uuid: 'p-1',
		name: 'Polygon 1',
		geom: { type: 'Polygon', coordinates: [] },
		created_at: '2026-01-01T00:00:00Z',
		...overrides
	};
}

describe('inquiryContext', () => {
	let ctx: ReturnType<typeof createInquiryContext>;

	beforeEach(() => {
		vi.clearAllMocks();
		ctx = createInquiryContext();
	});

	describe('createInquiryContext', () => {
		test('should register the context via setContext', () => {
			expect(setContext).toHaveBeenCalledOnce();
			expect(setContext).toHaveBeenCalledWith(expect.any(Symbol), ctx);
		});

		test('should initialize with an empty polygon list', () => {
			expect(ctx.polygons).toEqual([]);
		});

		test('should initialize all boolean flags to false', () => {
			expect(ctx.isDrawing).toBe(false);
			expect(ctx.isEditing).toBe(false);
			expect(ctx.isSaving).toBe(false);
		});
	});

	describe('addPolygon', () => {
		test('should append a polygon to the list', () => {
			const polygon = makePolygon();
			ctx.addPolygon(polygon);
			expect(ctx.polygons).toEqual([polygon]);
		});

		test('should preserve existing polygons and their order', () => {
			const a = makePolygon({ uuid: 'a' });
			const b = makePolygon({ uuid: 'b' });
			ctx.addPolygon(a);
			ctx.addPolygon(b);
			expect(ctx.polygons.map((p) => p.uuid)).toEqual(['a', 'b']);
		});

		test('should create a new array reference (immutability)', () => {
			const before = ctx.polygons;
			ctx.addPolygon(makePolygon());
			expect(ctx.polygons).not.toBe(before);
		});
	});

	describe('removePolygon', () => {
		test('should remove the polygon matching the uuid', () => {
			ctx.setPolygons([makePolygon({ uuid: 'a' }), makePolygon({ uuid: 'b' })]);
			ctx.removePolygon('a');
			expect(ctx.polygons.map((p) => p.uuid)).toEqual(['b']);
		});

		test('should leave the list unchanged when uuid is not found', () => {
			ctx.setPolygons([makePolygon({ uuid: 'a' })]);
			ctx.removePolygon('does-not-exist');
			expect(ctx.polygons.map((p) => p.uuid)).toEqual(['a']);
		});
	});

	describe('updatePolygonGeom', () => {
		test('should update the geometry of the matching polygon only', () => {
			ctx.setPolygons([makePolygon({ uuid: 'a' }), makePolygon({ uuid: 'b' })]);
			const newGeom = { type: 'Point', coordinates: [1, 2] };
			ctx.updatePolygonGeom('b', newGeom);

			const a = ctx.polygons.find((p) => p.uuid === 'a')!;
			const b = ctx.polygons.find((p) => p.uuid === 'b')!;
			expect(b.geom).toEqual(newGeom);
			expect(a.geom).toEqual({ type: 'Polygon', coordinates: [] });
		});

		test('should accept null to clear the geometry', () => {
			ctx.setPolygons([makePolygon({ uuid: 'a' })]);
			ctx.updatePolygonGeom('a', null);
			expect(ctx.polygons[0].geom).toBeNull();
		});

		test('should not add a polygon when the uuid is missing', () => {
			ctx.setPolygons([makePolygon({ uuid: 'a' })]);
			ctx.updatePolygonGeom('missing', { type: 'Point', coordinates: [0, 0] });
			expect(ctx.polygons).toHaveLength(1);
			expect(ctx.polygons[0].uuid).toBe('a');
		});
	});

	describe('updatePolygonName', () => {
		test('should update the name of the matching polygon only', () => {
			ctx.setPolygons([
				makePolygon({ uuid: 'a', name: 'Old A' }),
				makePolygon({ uuid: 'b', name: 'Old B' })
			]);
			ctx.updatePolygonName('a', 'New A');

			expect(ctx.polygons.find((p) => p.uuid === 'a')!.name).toBe('New A');
			expect(ctx.polygons.find((p) => p.uuid === 'b')!.name).toBe('Old B');
		});

		test('should leave the list unchanged when uuid is not found', () => {
			ctx.setPolygons([makePolygon({ uuid: 'a', name: 'Keep' })]);
			ctx.updatePolygonName('missing', 'Ignored');
			expect(ctx.polygons[0].name).toBe('Keep');
		});
	});

	describe('setPolygons', () => {
		test('should replace the entire polygon list', () => {
			ctx.addPolygon(makePolygon({ uuid: 'old' }));
			const replacement = [makePolygon({ uuid: 'x' }), makePolygon({ uuid: 'y' })];
			ctx.setPolygons(replacement);
			expect(ctx.polygons).toEqual(replacement);
			expect(ctx.polygons.map((p) => p.uuid)).toEqual(['x', 'y']);
		});

		test('should accept an empty array', () => {
			ctx.addPolygon(makePolygon());
			ctx.setPolygons([]);
			expect(ctx.polygons).toEqual([]);
		});
	});

	describe('boolean flag setters', () => {
		test('setDrawing should update isDrawing', () => {
			ctx.setDrawing(true);
			expect(ctx.isDrawing).toBe(true);
			ctx.setDrawing(false);
			expect(ctx.isDrawing).toBe(false);
		});

		test('setEditing should update isEditing', () => {
			ctx.setEditing(true);
			expect(ctx.isEditing).toBe(true);
			ctx.setEditing(false);
			expect(ctx.isEditing).toBe(false);
		});

		test('setSaving should update isSaving', () => {
			ctx.setSaving(true);
			expect(ctx.isSaving).toBe(true);
			ctx.setSaving(false);
			expect(ctx.isSaving).toBe(false);
		});
	});

	describe('reset', () => {
		test('should clear polygons and reset all flags', () => {
			ctx.addPolygon(makePolygon());
			ctx.setDrawing(true);
			ctx.setEditing(true);
			ctx.setSaving(true);

			ctx.reset();

			expect(ctx.polygons).toEqual([]);
			expect(ctx.isDrawing).toBe(false);
			expect(ctx.isEditing).toBe(false);
			expect(ctx.isSaving).toBe(false);
		});
	});

	describe('getInquiryContext', () => {
		test('should return the context registered by createInquiryContext', () => {
			expect(getInquiryContext()).toBe(ctx);
		});
	});
});
