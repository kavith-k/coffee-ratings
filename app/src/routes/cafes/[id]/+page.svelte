<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		Card,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import RatingForm from '$lib/components/RatingForm.svelte';

	let { data, form } = $props();

	function formatRating(r: number | null): string {
		return r === null ? '—' : r.toFixed(1);
	}
</script>

<div class="mx-auto max-w-2xl px-4 py-8">
	<a href="/" class="text-sm text-muted-foreground hover:underline">Back to cafes</a>
	<h1 class="mt-1 text-2xl font-semibold">{data.cafe.name}</h1>
	{#if data.cafe.area}
		<p class="text-muted-foreground">{data.cafe.area}</p>
	{/if}

	<Card class="my-6">
		<CardHeader>
			<CardTitle class="text-4xl">{formatRating(data.stats.avg_rating)}</CardTitle>
			<CardDescription>
				{#if data.stats.num_ratings === 0}
					No ratings from your groups yet
				{:else}
					{data.stats.num_ratings}
					{data.stats.num_ratings === 1 ? 'rating' : 'ratings'} from
					{data.stats.num_raters}
					{data.stats.num_raters === 1 ? 'person' : 'people'}
				{/if}
			</CardDescription>
		</CardHeader>
	</Card>

	<RatingForm {form} />

	{#if data.ratings.length > 0}
		<h2 class="mb-3 text-lg font-semibold">Recent ratings</h2>
		<ul class="grid gap-3">
			{#each data.ratings as rating (rating.id)}
				<li class="flex items-center justify-between gap-2 rounded border p-3">
					<div>
						<a href="/users/{rating.user_id}" class="font-medium hover:underline">
							{rating.display_name}
						</a>
						<p class="text-xs text-muted-foreground">
							Visited {rating.visited_at}
						</p>
					</div>
					<Badge variant="secondary" class="text-lg">{rating.rating.toFixed(1)}</Badge>
				</li>
			{/each}
		</ul>
	{/if}
</div>
