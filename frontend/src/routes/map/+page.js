import { m } from '$lib/paraglide/messages';

/** @type {import('./$types').PageLoad} */
export async function load() {
	let alias = {
		flag: m.form_flag(),
		name: m.common_name(),
		status: m.form_status(),
		network_level: m.form_network_level(),
		owner: m.form_owner(),
		constructor: m.form_constructor(),
		manufacturer: m.form_manufacturer(),
		date: m.common_date(),
		node_type: m.form_node_type(),
		warranty: m.form_warranty(),
		surface: m.form_surface(),
		construction_type: m.form_construction_type(),
		id_trench: m.form_trench_id(),
		length: m.common_length(),
		phase: m.form_phase(),
		construction_depth: m.form_construction_depth(),
		construction_details: m.form_construction_details(),
		internal_execution: m.form_internal_execution(),
		funding_status: m.form_funding_status(),
		comment: m.common_comment(),
		address: m.form_address(),
		id_address: m.form_address_id(),
		zip_code: m.form_zip_code(),
		city: m.form_city(),
		district: m.form_district(),
		street: m.form_street(),
		housenumber: m.form_housenumber(),
		house_number_suffix: m.form_house_number_suffix(),
		status_development: m.form_status_development(),
		house_connection: m.form_house_connection()
	};
	return { alias };
}
