<script lang="ts">
	import MapView from '$lib/components/MapView.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';

	let { data } = $props();
</script>

{#if data.cafes.length === 0}
	<div class="mx-auto max-w-2xl px-4 py-6">
		<EmptyState
			title="No cafes on the map"
			message="Rated cafes with coordinates will appear here. Rate a cafe to get started."
			actionLabel="Rate a cafe"
			actionHref="/cafes/new"
		/>
	</div>
{:else}
	<div class="h-[calc(100dvh-5rem)] md:h-dvh">
		<MapView cafes={data.cafes} />
	</div>
{/if}
