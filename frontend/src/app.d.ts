declare global {
	namespace App {
		interface Locals {
			user: import('$lib/stores/auth').UserData;
		}
	}
}

export {};
