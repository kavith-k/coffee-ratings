<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { validateRatingInput } from '$lib/utils/rating-validation';

	let {
		form
	}: {
		form?: { success?: boolean; error?: string } | null;
	} = $props();

	// Default visit date is today (YYYY-MM-DD in the user's local tz).
	function todayIso(): string {
		const d = new Date();
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		return `${yyyy}-${mm}-${dd}`;
	}

	let rating = $state('');
	let visitedAt = $state(todayIso());

	const clientValidation = $derived(validateRatingInput(rating, visitedAt));
	const submitDisabled = $derived(!clientValidation.ok);
</script>

<form method="POST" action="?/submitRating" class="grid gap-4 rounded-lg border p-4">
	<h2 class="text-lg font-semibold">Add your rating</h2>

	<div class="grid gap-2">
		<Label for="rating">Rating (0-7, one decimal)</Label>
		<Input
			id="rating"
			name="rating"
			type="number"
			min="0"
			max="7"
			step="0.1"
			required
			bind:value={rating}
			placeholder="6.2"
		/>
	</div>

	<div class="grid gap-2">
		<Label for="visited_at">Visit date</Label>
		<Input
			id="visited_at"
			name="visited_at"
			type="date"
			max={todayIso()}
			required
			bind:value={visitedAt}
		/>
	</div>

	{#if form?.error}
		<p class="text-sm text-destructive">{form.error}</p>
	{:else if !clientValidation.ok && rating !== ''}
		<p class="text-sm text-muted-foreground">{clientValidation.error}</p>
	{:else if form?.success}
		<p class="text-sm text-green-600">Thanks, rating saved.</p>
	{/if}

	<Button type="submit" class="h-11 md:h-10" disabled={submitDisabled}>Save rating</Button>
</form>
