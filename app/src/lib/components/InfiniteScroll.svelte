<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';

	// Sentinel-based infinite scroll. The parent renders its own list; we
	// just watch a sentinel element at the bottom and invoke `loadMore` when
	// it enters the viewport. The parent is responsible for awaiting the
	// promise and flipping `hasMore` to false when the feed is exhausted.
	// We gate on an internal `loading` flag so a fast scroll cannot fire
	// multiple concurrent calls.

	let {
		loadMore,
		hasMore,
		rootMargin = '200px'
	}: {
		loadMore: () => Promise<void>;
		hasMore: boolean;
		rootMargin?: string;
	} = $props();

	let loading = $state(false);

	const observe: Attachment<HTMLDivElement> = (element) => {
		if (typeof IntersectionObserver === 'undefined') return;

		const observer = new IntersectionObserver(
			async (entries) => {
				const entry = entries[0];
				if (!entry.isIntersecting || loading || !hasMore) return;
				loading = true;
				try {
					await loadMore();
				} finally {
					loading = false;
				}
			},
			{ rootMargin }
		);
		observer.observe(element);
		return () => observer.disconnect();
	};
</script>

{#if hasMore}
	<div {@attach observe} class="mt-3" aria-hidden="true"></div>
	{#if loading}
		<ul class="mt-3 grid gap-3" aria-busy="true" aria-live="polite">
			{#each Array(3) as _, i (i)}
				<li class="flex items-center gap-4 rounded-lg border p-3">
					<Skeleton class="h-10 w-10 rounded-full" />
					<div class="flex-1 space-y-2">
						<Skeleton class="h-4 w-3/4" />
						<Skeleton class="h-3 w-1/2" />
					</div>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
