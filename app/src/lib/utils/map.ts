import { getRatingBucket, type RatingBucket } from './rating-colour';

export const MAP_DEFAULTS = {
	centre: [53.3498, -6.2603] as [number, number],
	zoom: 13
};

// Hex colours that match the Tailwind palette used by RatingBadge, but as raw
// hex strings for Leaflet's circleMarker API which doesn't understand Tailwind
// classes. The bucket lookup is delegated to getRatingBucket so the boundary
// logic lives in one place.
const BUCKET_HEX: Record<RatingBucket, string> = {
	none: '#64748b', // slate-500 -- contrasts against the grey Positron basemap
	red: '#dc2626', // red-600
	orange: '#f97316', // orange-500
	yellow: '#facc15', // yellow-400
	green: '#16a34a', // green-600
	emerald: '#047857' // emerald-700
};

export function getRatingHex(rating: number | null): string {
	return BUCKET_HEX[getRatingBucket(rating)];
}
