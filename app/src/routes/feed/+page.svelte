<script lang="ts">
	import { untrack } from 'svelte';
	import RatingBadge from '$lib/components/RatingBadge.svelte';
	import InfiniteScroll from '$lib/components/InfiniteScroll.svelte';

	type FeedItem = {
		rating_id: string;
		user_id: string;
		display_name: string;
		cafe_id: string;
		cafe_name: string;
		area: string | null;
		rating: number;
		visited_at: string;
		created_at: string;
	};

	let { data } = $props();

	// Seed from the server load, then own the pagination state locally.
	// `untrack` is deliberate: we want the initial value only, because any
	// re-run of the load should be handled by a fresh mount, not by mixing
	// fresh data with an in-flight appended tail.
	let items = $state<FeedItem[]>(untrack(() => data.items));
	let nextCursor = $state<string | null>(untrack(() => data.nextCursor));

	async function loadMore() {
		if (nextCursor === null) return;

		const url = '/feed/items?cursor=' + encodeURIComponent(nextCursor);
		const response = await fetch(url);
		if (!response.ok) {
			// Stop trying -- unmount the sentinel so we don't hammer a broken
			// endpoint on every scroll. The user can refresh to retry.
			nextCursor = null;
			return;
		}

		const body = (await response.json()) as {
			items: FeedItem[];
			nextCursor: string | null;
		};

		items = [...items, ...body.items];
		nextCursor = body.nextCursor;
	}
</script>

<div class="mx-auto max-w-2xl px-4 py-6">
	<h1 class="mb-6 text-2xl font-semibold">Activity</h1>

	{#if items.length === 0}
		<p class="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
			Nothing to show yet. Ratings from people in your groups will appear here.
		</p>
	{:else}
		<ul class="grid gap-3">
			{#each items as item (item.rating_id)}
				<li class="flex items-center gap-4 rounded-lg border p-3">
					<RatingBadge rating={item.rating} />
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm">
							<a href="/users/{item.user_id}" class="font-medium hover:underline">
								{item.display_name}
							</a>
							<span class="text-muted-foreground">rated</span>
							<a href="/cafes/{item.cafe_id}" class="font-medium hover:underline">
								{item.cafe_name}
							</a>
						</p>
						<p class="text-xs text-muted-foreground">
							Visited {item.visited_at}
						</p>
					</div>
				</li>
			{/each}
		</ul>

		<InfiniteScroll {loadMore} hasMore={nextCursor !== null} />
	{/if}
</div>
