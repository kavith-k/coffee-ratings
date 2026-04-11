// Rating-to-colour mapping used by RatingBadge and CafeCard. Boundaries are
// inclusive on the upper edge (2.0 is red, 2.1 is orange). Bucket names are
// kept abstract so the Tailwind classes can be swapped in the component layer
// without rewriting this module.

export type RatingBucket = 'none' | 'red' | 'orange' | 'yellow' | 'green' | 'emerald';

export function getRatingBucket(rating: number | null): RatingBucket {
	if (rating === null) return 'none';
	if (rating <= 2.0) return 'red';
	if (rating <= 4.0) return 'orange';
	if (rating <= 5.0) return 'yellow';
	if (rating <= 6.0) return 'green';
	return 'emerald';
}

// Tailwind class lookup. Centralised so the colour palette lives in one
// place and every component that shows a rating agrees.
const BUCKET_CLASSES: Record<RatingBucket, string> = {
	none: 'bg-muted text-muted-foreground',
	red: 'bg-red-600 text-white',
	orange: 'bg-orange-500 text-white',
	yellow: 'bg-yellow-400 text-black',
	green: 'bg-green-600 text-white',
	emerald: 'bg-emerald-700 text-white'
};

export function getRatingClasses(rating: number | null): string {
	return BUCKET_CLASSES[getRatingBucket(rating)];
}
