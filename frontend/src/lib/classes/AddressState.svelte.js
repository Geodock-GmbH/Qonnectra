/**
 * @typedef {Object} AddressData
 * @property {string} uuid
 * @property {string} [street]
 * @property {string|number} [housenumber]
 * @property {string} [house_number_suffix]
 * @property {string} [zip_code]
 * @property {string} [city]
 * @property {string} [district]
 * @property {{status_development?: string}} [status_development]
 * @property {{flag?: string}} [flag]
 */

/**
 * @typedef {Object} FormattedAddress
 * @property {string} value
 * @property {string} street
 * @property {string|number} housenumber
 * @property {string} house_number_suffix
 * @property {string} zip_code
 * @property {string} city
 * @property {string} district
 * @property {string} status_development
 * @property {string} flag
 */

/**
 * State manager for the address route
 * Manages addresses array and provides methods for CRUD operations
 */
export class AddressState {
	/** @type {FormattedAddress[]} */
	addresses = $state.raw([]);

	/**
	 * Initialize state with addresses from load function
	 * @param {{addresses?: FormattedAddress[]}} initialData - Data from +page.server.js load function
	 */
	constructor(initialData) {
		this.addresses = initialData.addresses || [];
	}

	/**
	 * Format address data from API response to table display format
	 * @param {AddressData} address - Raw address data from API
	 * @returns {FormattedAddress} Formatted address for table display
	 */
	formatAddress(address) {
		return {
			value: address.uuid,
			street: address.street || '',
			housenumber: address.housenumber ?? '',
			house_number_suffix: address.house_number_suffix || '',
			zip_code: address.zip_code || '',
			city: address.city || '',
			district: address.district || '',
			status_development: address.status_development?.status_development || '',
			flag: address.flag?.flag || ''
		};
	}

	/**
	 * Update an address in local state
	 * @param {AddressData} updatedAddress - Updated address data from API
	 */
	updateAddress(updatedAddress) {
		const index = this.addresses.findIndex((a) => a.value === updatedAddress.uuid);
		if (index !== -1) {
			const formattedAddress = this.formatAddress(updatedAddress);
			this.addresses = [
				...this.addresses.slice(0, index),
				formattedAddress,
				...this.addresses.slice(index + 1)
			];
		}
	}

	/**
	 * Delete an address from local state
	 * @param {string} addressId - UUID of address to delete
	 */
	deleteAddress(addressId) {
		this.addresses = this.addresses.filter((a) => a.value !== addressId);
	}

	/**
	 * Set addresses array (used when data is reloaded, e.g., after search)
	 * @param {FormattedAddress[]} addresses - Array of formatted addresses from load function
	 */
	setAddresses(addresses) {
		this.addresses = addresses || [];
	}
}
