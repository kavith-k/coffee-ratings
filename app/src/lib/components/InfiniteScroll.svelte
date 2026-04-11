<script lang="ts">
	import type { Attachment } from 'svelte/attachments';

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
	<div {@attach observe} class="flex justify-center py-6" aria-hidden="true">
		{#if loading}
			<span class="text-sm text-muted-foreground">Loading…</span>
		{/if}
	</div>
{/if}
