import { m } from '$lib/paraglide/messages';

/** @type {import('./$types').PageLoad} */
export async function load() {
	let alias = {
		flag: m.flag(),
		name: m.name(),
		status: m.status(),
		network_level: m.network_level(),
		owner: m.owner(),
		constructor: m.constructor(),
		manufacturer: m.manufacturer(),
		date: m.date(),
		node_type: m.node_type(),
		warranty: m.warranty(),
		surface: m.surface(),
		construction_type: m.construction_type(),
		id_trench: m.id_trench(),
		length: m.length(),
		phase: m.phase(),
		construction_depth: m.construction_depth(),
		construction_details: m.construction_details(),
		internal_execution: m.internal_execution(),
		funding_status: m.funding_status(),
		comment: m.comment(),
		address: m.address(),
		id_address: m.id_address(),
		zip_code: m.zip_code(),
		city: m.city(),
		district: m.district(),
		street: m.street(),
		housenumber: m.housenumber(),
		house_number_suffix: m.house_number_suffix(),
		status_development: m.status_development(),
		house_connection: m.house_connection()
	};
	return { alias };
}
