/**
 * Parse devalue serialized format back to plain JavaScript object
 *
 * Devalue format: [schema, ...values]
 * - schema is an object with keys mapping to array indices
 * - remaining array elements are the actual values
 *
 * Example:
 * [{uuid:1, name:2}, "123-456", "Cable Name"]
 * becomes
 * {uuid: "123-456", name: "Cable Name"}
 *
 * @param {Array|Object|string} data - The devalue serialized data
 * @returns {Object} Plain JavaScript object
 */
export function parseDevalue(data) {
	if (!data) return {};

	// Handle SvelteKit form action response wrapper
	// { type: "success", status: 200, data: "..." }
	if (typeof data === 'object' && !Array.isArray(data) && 'data' in data) {
		data = data.data;
	}

	// If it's a string, parse it first
	if (typeof data === 'string') {
		try {
			data = JSON.parse(data);
		} catch (e) {
			console.error('Failed to parse JSON string:', e);
			return {};
		}
	}

	// If already a plain object (not array), return it as-is
	if (!Array.isArray(data) && typeof data === 'object') {
		return data;
	}

	// If not an array or empty, return empty object
	if (!Array.isArray(data) || data.length === 0) {
		return {};
	}

	// Index 0 contains the schema (key -> valueIndex mapping)
	const schema = data[0];
	if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
		return {};
	}

	// Recursively parse nested objects
	function parseValue(value) {
		if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && !Array.isArray(value[0])) {
			return parseDevalue(value);
		}
		return value;
	}

	// Reconstruct the object from schema and values
	const result = {};
	for (const [key, valueIndex] of Object.entries(schema)) {
		const rawValue = data[valueIndex];
		result[key] = parseValue(rawValue);
	}

	return result;
}
