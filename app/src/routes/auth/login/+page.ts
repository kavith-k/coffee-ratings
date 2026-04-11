import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	return {
		next: url.searchParams.get('next')
	};
};
