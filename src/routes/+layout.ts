import { initAppServices } from '$lib/app/composition';
import { browser } from '$app/environment';

export const ssr = false;
export const prerender = true;

export async function load() {
	if (browser) {
		await initAppServices();
	}
}
