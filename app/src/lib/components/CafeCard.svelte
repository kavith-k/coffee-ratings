<script lang="ts">
	import RatingBadge from './RatingBadge.svelte';

	let {
		id,
		name,
		area,
		avgRating,
		numRatings,
		numRaters
	}: {
		id: string;
		name: string;
		area: string | null;
		avgRating: number | null;
		numRatings: number;
		numRaters: number;
	} = $props();

	const raterSummary = $derived(
		numRatings === 0
			? 'No ratings yet'
			: `${numRatings} ${numRatings === 1 ? 'rating' : 'ratings'} from ${numRaters} ${numRaters === 1 ? 'person' : 'people'}`
	);
</script>

<a
	href="/cafes/{id}"
	class="flex items-center gap-4 rounded-lg border bg-card p-4 transition hover:bg-accent"
>
	<RatingBadge rating={avgRating} size="lg" />
	<div class="min-w-0 flex-1">
		<p class="truncate font-medium">{name}</p>
		{#if area}
			<p class="truncate text-sm text-muted-foreground">{area}</p>
		{/if}
		<p class="text-xs text-muted-foreground">{raterSummary}</p>
	</div>
</a>
