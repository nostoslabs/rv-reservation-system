import { initAppServices } from '$lib/app/composition';
import { injectAnalytics } from '@vercel/analytics/sveltekit';
import { browser } from '$app/environment';

export const ssr = false;
export const prerender = true;

injectAnalytics({ mode: 'auto' });

export async function load() {
	if (browser) {
		await initAppServices();
	}
}
