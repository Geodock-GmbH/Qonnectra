/** Small randomness helpers for user behaviour. */
import { sleep } from 'k6';

import { config } from './config.js';

/**
 * Returns a random element.
 * @template T
 * @param {T[]} list
 * @returns {T | undefined}
 */
export function pick(list) {
	return list.length ? list[Math.floor(Math.random() * list.length)] : undefined;
}

/**
 * Returns an integer in [min, max].
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function between(min, max) {
	return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Returns true with the given probability.
 * @param {number} probability - 0..1
 * @returns {boolean}
 */
export function chance(probability) {
	return Math.random() < probability;
}

/**
 * Pauses like a user reading or moving the mouse, scaled by THINK.
 * @param {number} min - Seconds.
 * @param {number} max - Seconds.
 */
export function think(min, max) {
	sleep((min + Math.random() * (max - min)) * config.thinkScale);
}

/**
 * Picks one key by weight.
 * @template {string} K
 * @param {Record<K, number>} weights
 * @returns {K}
 */
export function weighted(weights) {
	const entries = /** @type {[K, number][]} */ (Object.entries(weights));
	let roll = Math.random() * entries.reduce((sum, [, w]) => sum + w, 0);
	for (const [key, weight] of entries) {
		roll -= weight;
		if (roll < 0) return key;
	}
	return entries[entries.length - 1][0];
}
