<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import RatingBadge from '$lib/components/RatingBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';

	let { data, form } = $props();

	const isOwnProfile = $derived(data.user?.id === data.profile.id);

	// Local draft -- intentionally non-reactive to `data.profile.display_name`
	// after mount. untrack() signals to the compiler that this initial read is
	// deliberate and we don't want the state to follow prop changes.
	let draftName = $state(untrack(() => data.profile.display_name));
	let saving = $state(false);

	const trimmedDraft = $derived(draftName.trim());
	const hasChanges = $derived(
		trimmedDraft.length > 0 && trimmedDraft !== data.profile.display_name
	);
</script>

<div class="mx-auto max-w-2xl px-4 py-6">
	{#if !isOwnProfile}
		<a href="/feed" class="text-sm text-muted-foreground hover:underline">Back</a>
		<h1 class="mt-1 text-2xl font-semibold">{data.profile.display_name}</h1>
	{:else}
		<Card>
			<CardHeader>
				<CardTitle>Your profile</CardTitle>
			</CardHeader>
			<CardContent class="grid gap-5">
				<div class="grid gap-1">
					<Label class="text-xs uppercase tracking-wide text-muted-foreground">
						Signed in as
					</Label>
					<p class="break-all text-sm">{data.user?.email ?? ''}</p>
				</div>

				<form
					method="POST"
					action="?/updateDisplayName"
					class="grid gap-2"
					use:enhance={() => {
						saving = true;
						return async ({ update }) => {
							saving = false;
							// reset: false -- default enhance behaviour calls
							// formElement.reset() on success, which blanks the
							// input. We want the field to keep showing the
							// saved name, so preserve the bound value.
							await update({ reset: false });
						};
					}}
				>
					<Label for="display_name">Display name</Label>
					<p class="text-xs text-muted-foreground">
						How others in your groups see you. You can change this anytime.
					</p>
					<div class="flex flex-wrap items-start gap-2">
						<Input
							id="display_name"
							name="display_name"
							type="text"
							required
							maxlength={50}
							bind:value={draftName}
							class="flex-1"
						/>
						<Button type="submit" disabled={!hasChanges || saving}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
					</div>
					{#if form?.error}
						<p class="text-sm text-destructive">{form.error}</p>
					{/if}
				</form>
			</CardContent>
		</Card>
	{/if}

	<section class="mt-6">
		<div class="mb-3 flex items-baseline justify-between">
			<h2 class="text-lg font-semibold">
				{isOwnProfile ? 'Your ratings' : 'Ratings'}
			</h2>
			<span class="text-sm text-muted-foreground">
				{data.ratings.length}
				{data.ratings.length === 1 ? 'rating' : 'ratings'}
			</span>
		</div>

		{#if data.ratings.length === 0}
			<EmptyState message="No ratings yet." />
		{:else}
			<ul class="grid gap-3">
				{#each data.ratings as rating (rating.id)}
					<li>
						{#if rating.cafe_id}
							<a
								href="/cafes/{rating.cafe_id}"
								class="flex items-center gap-4 rounded-lg border bg-card p-3 transition hover:bg-accent"
							>
								<RatingBadge rating={rating.rating} />
								<div class="min-w-0 flex-1">
									<p class="truncate font-medium">{rating.cafe_name}</p>
									{#if rating.cafe_area}
										<p class="truncate text-xs text-muted-foreground">{rating.cafe_area}</p>
									{/if}
									<p class="text-xs text-muted-foreground">Visited {rating.visited_at}</p>
								</div>
							</a>
						{:else}
							<div class="flex items-center gap-4 rounded-lg border bg-card p-3">
								<RatingBadge rating={rating.rating} />
								<div class="min-w-0 flex-1">
									<p class="truncate font-medium text-muted-foreground">{rating.cafe_name}</p>
									<p class="text-xs text-muted-foreground">Visited {rating.visited_at}</p>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
