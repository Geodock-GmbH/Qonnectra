import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Default values
const defaultCenter = [0, 0];
const defaultZoom = 2;

// Function to get initial value from localStorage or use default
const getInitialValue = (key, defaultValue) => {
	if (!browser) return defaultValue; // Don't access localStorage during SSR
	const storedValue = localStorage.getItem(key);
	if (storedValue) {
		try {
			return JSON.parse(storedValue);
		} catch (e) {
			console.error(`Error parsing localStorage item ${key}:`, e);
			localStorage.removeItem(key); // Remove corrupted item
			return defaultValue;
		}
	} else {
		return defaultValue;
	}
};

// Create writable stores for center and zoom
const initialCenter = getInitialValue('mapCenter', defaultCenter);
const initialZoom = getInitialValue('mapZoom', defaultZoom);

export const mapCenter = writable(initialCenter);
export const mapZoom = writable(initialZoom);

// Subscribe to changes and update localStorage
if (browser) {
	mapCenter.subscribe((value) => {
		localStorage.setItem('mapCenter', JSON.stringify(value));
	});

	mapZoom.subscribe((value) => {
		localStorage.setItem('mapZoom', String(value)); // Zoom is a number
	});
}
