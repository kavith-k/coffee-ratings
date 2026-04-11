<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import CafeCard from '$lib/components/CafeCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	let { data } = $props();

	// Build a fresh URL with the given overrides and navigate. We use
	// `keepFocus` so keyboard users don't lose their place when toggling.
	// Passing `null` for a key removes it; passing the current value is a
	// no-op from the user's perspective and is handled by goto's dedupe.
	function updateParams(overrides: Record<string, string | null>) {
		const params = new URLSearchParams(page.url.searchParams);
		for (const [key, value] of Object.entries(overrides)) {
			if (value === null || value === '') {
				params.delete(key);
			} else {
				params.set(key, value);
			}
		}
		const qs = params.toString();
		goto(qs ? `/?${qs}` : '/', { keepFocus: true, noScroll: true });
	}

	function onAreaChange(e: Event) {
		const target = e.currentTarget as HTMLSelectElement;
		updateParams({ area: target.value || null });
	}
</script>

<div class="mx-auto max-w-2xl px-4 py-6">
	<header class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-semibold">Cafes</h1>
		<a href="/cafes/new" class="text-sm text-primary hover:underline">Add cafe</a>
	</header>

	<div class="mb-4 flex flex-wrap items-center gap-3">
		<label class="flex items-center gap-2 text-sm">
			<span class="text-muted-foreground">Area</span>
			<select
				class="rounded-md border bg-background px-2 py-1 text-sm"
				value={data.activeArea ?? ''}
				onchange={onAreaChange}
			>
				<option value="">All areas</option>
				{#each data.areas as area (area)}
					<option value={area}>{area}</option>
				{/each}
			</select>
		</label>

		<div class="ml-auto flex items-center gap-1" role="group" aria-label="Sort cafes by">
			<Button
				variant={data.activeSort === 'avg_rating' ? 'default' : 'outline'}
				size="sm"
				onclick={() => updateParams({ sort: null })}
			>
				Top rated
			</Button>
			<Button
				variant={data.activeSort === 'num_ratings' ? 'default' : 'outline'}
				size="sm"
				onclick={() => updateParams({ sort: 'num_ratings' })}
			>
				Most rated
			</Button>
		</div>
	</div>

	{#if data.cafes.length === 0}
		<EmptyState
			title="No cafes yet"
			message="Ratings from people in your groups will show here. Add a cafe to start rating it."
			actionLabel="Add a cafe"
			actionHref="/cafes/new"
		/>
	{:else}
		<ul class="grid gap-3">
			{#each data.cafes as cafe (cafe.cafe_id)}
				<li>
					<CafeCard
						id={cafe.cafe_id}
						name={cafe.cafe_name}
						area={cafe.area}
						avgRating={cafe.avg_rating}
						numRatings={Number(cafe.num_ratings)}
						numRaters={Number(cafe.num_raters)}
					/>
				</li>
			{/each}
		</ul>
	{/if}
</div>
