/**
 * Checks the map scenario's tile math, so the load test requests the tiles a
 * real viewport needs. Run: node --test loadtest/k6/lib/
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fitZoom, step, tileBbox, TileCache, tilesForView, tileZoom, viewExtent } from './tiles.js';

const KASSEL = { x: 1056000, y: 6672000 };

test('512px grid uses one zoom level below the view zoom', () => {
	assert.equal(tileZoom(17), 16);
	assert.equal(tileZoom(16.6), 16);
	assert.equal(tileZoom(0), 0);
});

test('a 1600x900 view at zoom 17 needs about 4x3 tiles', () => {
	const tiles = tilesForView({ ...KASSEL, zoom: 17, width: 1600, height: 900 });

	assert.ok(tiles.length >= 6 && tiles.length <= 12, `got ${tiles.length}`);
	assert.ok(tiles.every((tile) => tile.z === 16));
});

test('tiles cover the whole view extent', () => {
	const view = { ...KASSEL, zoom: 15, width: 1600, height: 900 };
	const [minX, minY, maxX, maxY] = viewExtent(view);
	const boxes = tilesForView(view).map((tile) => tileBbox(tile).split(',').map(Number));

	assert.ok(Math.min(...boxes.map((b) => b[0])) <= minX);
	assert.ok(Math.min(...boxes.map((b) => b[1])) <= minY);
	assert.ok(Math.max(...boxes.map((b) => b[2])) >= maxX);
	assert.ok(Math.max(...boxes.map((b) => b[3])) >= maxY);
});

test('fitZoom fits a 5 km extent into the viewport', () => {
	const extent = /** @type {[number, number, number, number]} */ ([
		KASSEL.x - 2500,
		KASSEL.y - 2500,
		KASSEL.x + 2500,
		KASSEL.y + 2500
	]);
	const zoom = fitZoom(extent, 1600, 900);
	const [minX, minY, maxX, maxY] = viewExtent({ ...KASSEL, zoom, width: 1600, height: 900 });

	assert.ok(maxX - minX >= 5000 && maxY - minY >= 5000);
	assert.ok(zoom >= 13 && zoom <= 15, `got ${zoom}`);
});

test('a pan keeps the center inside the work extent', () => {
	const extent = /** @type {[number, number, number, number]} */ ([0, 0, 100, 100]);
	let view = { x: 50, y: 50, zoom: 10, width: 1600, height: 900 };
	for (let i = 0; i < 20; i++) view = step(view, 'pan', extent, Math.random, 5);

	assert.ok(view.x >= 0 && view.x <= 100 && view.y >= 0 && view.y <= 100);
});

test('TileCache only reports tiles that newly came into view', () => {
	const cache = new TileCache(100);
	const view = { ...KASSEL, zoom: 17, width: 1600, height: 900 };
	const first = cache.missing(tilesForView(view));
	const again = cache.missing(tilesForView(view));
	const panned = cache.missing(tilesForView({ ...view, x: view.x + 600 }));

	assert.equal(again.length, 0);
	assert.ok(panned.length > 0 && panned.length < first.length);
});

test('TileCache evicts the oldest tiles beyond its capacity', () => {
	const cache = new TileCache(2);
	cache.missing([
		{ z: 1, x: 0, y: 0 },
		{ z: 1, x: 1, y: 0 },
		{ z: 1, x: 0, y: 1 }
	]);

	assert.equal(cache.missing([{ z: 1, x: 0, y: 0 }]).length, 1);
});
