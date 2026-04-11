<script lang="ts">
	import RatingBadge from '$lib/components/RatingBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';

	let { data } = $props();
</script>

<div class="mx-auto max-w-2xl px-4 py-6">
	<a href="/feed" class="text-sm text-muted-foreground hover:underline">Back</a>
	<h1 class="mt-1 text-2xl font-semibold">{data.profile.display_name}</h1>
	<p class="text-sm text-muted-foreground">
		{data.ratings.length}
		{data.ratings.length === 1 ? 'rating' : 'ratings'}
	</p>

	{#if data.ratings.length === 0}
		<div class="mt-6">
			<EmptyState message="No ratings yet." />
		</div>
	{:else}
		<ul class="mt-6 grid gap-3">
			{#each data.ratings as rating (rating.id)}
				<li class="flex items-center gap-4 rounded-lg border p-3">
					<RatingBadge rating={rating.rating} />
					<div class="min-w-0 flex-1">
						{#if rating.cafe_id}
							<a href="/cafes/{rating.cafe_id}" class="truncate font-medium hover:underline">
								{rating.cafe_name}
							</a>
						{:else}
							<span class="truncate font-medium text-muted-foreground">{rating.cafe_name}</span>
						{/if}
						{#if rating.cafe_area}
							<p class="truncate text-xs text-muted-foreground">{rating.cafe_area}</p>
						{/if}
						<p class="text-xs text-muted-foreground">Visited {rating.visited_at}</p>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
