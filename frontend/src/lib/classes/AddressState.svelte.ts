interface AddressData {
	uuid: string;
	street?: string;
	housenumber?: string | number;
	house_number_suffix?: string;
	zip_code?: string;
	city?: string;
	district?: string;
	status_development?: { status_development?: string };
	flag?: { flag?: string };
}

interface FormattedAddress {
	value: string;
	street: string;
	housenumber: string | number;
	house_number_suffix: string;
	zip_code: string;
	city: string;
	district: string;
	status_development: string;
	flag: string;
}

/**
 * State manager for the address route
 * Manages addresses array and provides methods for CRUD operations
 */
export class AddressState {
	addresses: FormattedAddress[] = $state.raw([]);

	/**
	 * Initialize state with addresses from load function
	 * @param initialData - Data from +page.server.js load function
	 */
	constructor(initialData: { addresses?: FormattedAddress[] }) {
		this.addresses = initialData.addresses || [];
	}

	/**
	 * Format address data from API response to table display format
	 * @param address - Raw address data from API
	 * @returns Formatted address for table display
	 */
	formatAddress(address: AddressData): FormattedAddress {
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
	 * @param updatedAddress - Updated address data from API
	 */
	updateAddress(updatedAddress: AddressData): void {
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
	 * @param addressId - UUID of address to delete
	 */
	deleteAddress(addressId: string): void {
		this.addresses = this.addresses.filter((a) => a.value !== addressId);
	}

	/**
	 * Set addresses array (used when data is reloaded, e.g., after search)
	 * @param addresses - Array of formatted addresses from load function
	 */
	setAddresses(addresses: FormattedAddress[]): void {
		this.addresses = addresses || [];
	}
}
