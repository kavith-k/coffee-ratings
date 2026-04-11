<script lang="ts">
	import { getRatingClasses } from '$lib/utils/rating-colour';

	let {
		rating,
		size = 'md'
	}: {
		rating: number | null;
		size?: 'sm' | 'md' | 'lg';
	} = $props();

	const classes = $derived(getRatingClasses(rating));
	const sizeClasses = $derived(
		size === 'sm'
			? 'h-7 w-10 text-sm'
			: size === 'lg'
				? 'h-14 w-16 text-2xl'
				: 'h-10 w-12 text-base'
	);
	const label = $derived(rating === null ? '—' : rating.toFixed(1));
</script>

<span
	class="inline-flex shrink-0 items-center justify-center rounded-md font-semibold tabular-nums {classes} {sizeClasses}"
	aria-label={rating === null ? 'Unrated' : `Rating ${label} out of 7`}
>
	{label}
</span>
