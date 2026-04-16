<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import CafeCard from '$lib/components/CafeCard.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import CoffeeIcon from '@lucide/svelte/icons/coffee';

	let { data } = $props();

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
</script>

<div class="mx-auto max-w-2xl px-4 py-6">
	<header class="mb-6">
		<h1 class="text-2xl font-semibold">Cafes</h1>
	</header>

	{#if data.cafes.length === 0}
		<div class="flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-12 text-center">
			<div class="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
				<CoffeeIcon class="size-7 text-muted-foreground" aria-hidden="true" />
			</div>
			<div>
				<h2 class="mb-1 text-lg font-semibold">No ratings yet</h2>
				<p class="mx-auto max-w-xs text-sm text-muted-foreground">
					Once you or someone in your groups rates a cafe, it will appear here ranked by score.
				</p>
			</div>
			<div class="flex flex-wrap justify-center gap-3 pt-2">
				<Button href="/cafes/new">
					<PlusIcon class="size-4" aria-hidden="true" />
					Add and rate a cafe
				</Button>
				<Button href="/groups" variant="outline">Invite friends</Button>
			</div>
		</div>
	{:else}
		<div class="mb-4 flex flex-wrap items-center justify-end gap-3">
			<div class="flex items-center gap-1" role="group" aria-label="Sort cafes by">
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

<a
	href="/cafes/new"
	aria-label="Add a cafe"
	class="bg-primary text-primary-foreground fixed bottom-24 right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition hover:brightness-110 active:scale-95 md:bottom-6"
>
	<PlusIcon class="size-6" aria-hidden="true" />
</a>
