<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	let { data } = $props();
</script>

<div class="mx-auto max-w-2xl px-4 py-8">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-semibold">Your groups</h1>
		<Button href="/groups/new">Create group</Button>
	</div>

	{#if data.groups.length === 0}
		<EmptyState
			title="No groups yet"
			message="Groups are how you share ratings with friends. Create one, or ask a friend to send you an invite link."
			actionLabel="Create your first group"
			actionHref="/groups/new"
		/>
	{:else}
		<ul class="grid gap-3">
			{#each data.groups as group (group.id)}
				<li>
					<a
						href="/groups/{group.id}"
						class="block rounded-lg border bg-card p-4 transition hover:bg-accent"
					>
						<span class="text-lg font-medium">{group.name}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
