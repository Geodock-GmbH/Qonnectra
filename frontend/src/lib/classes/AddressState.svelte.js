/**
 * State manager for the address route
 * Manages addresses array and provides methods for CRUD operations
 */
export class AddressState {
	addresses = $state.raw([]);

	/**
	 * Initialize state with addresses from load function
	 * @param {Object} initialData - Data from +page.server.js load function
	 */
	constructor(initialData) {
		this.addresses = initialData.addresses || [];
	}

	/**
	 * Format address data from API response to table display format
	 * @param {Object} address - Raw address data from API
	 * @returns {Object} Formatted address for table display
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
	 * @param {Object} updatedAddress - Updated address data from API
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
	 * @param {Array} addresses - Array of formatted addresses from load function
	 */
	setAddresses(addresses) {
		this.addresses = addresses || [];
	}
}
