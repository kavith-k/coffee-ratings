<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import CafeAutocomplete from '$lib/components/CafeAutocomplete.svelte';
	import { page } from '$app/state';

	let { form } = $props();

	let cafeName = $state('');
	let area = $state('');
	let existingCafeId = $state('');

	function handleSelect(cafe: { id: string; name: string; area: string | null } | null) {
		if (cafe) {
			existingCafeId = cafe.id;
			area = cafe.area ?? '';
		} else {
			existingCafeId = '';
		}
	}
</script>

<div class="mx-auto max-w-md px-4 py-8">
	<Card>
		<CardHeader>
			<CardTitle>Add a cafe</CardTitle>
			<CardDescription>
				Cafes are shared across everyone. If a friend has already added this one, pick it from
				the suggestions instead of creating a duplicate.
			</CardDescription>
		</CardHeader>
		<CardContent>
			<form method="POST" class="grid gap-4">
				<div class="grid gap-2">
					<Label for="name">Name</Label>
					<CafeAutocomplete
						supabase={page.data.supabase}
						bind:value={cafeName}
						onSelect={handleSelect}
					/>
				</div>

				<div class="grid gap-2">
					<Label for="area">Neighbourhood</Label>
					<Input
						id="area"
						name="area"
						type="text"
						maxlength={100}
						bind:value={area}
						placeholder="Stoneybatter"
					/>
				</div>

				<input type="hidden" name="existingCafeId" value={existingCafeId} />

				{#if form?.error}
					<p class="text-sm text-destructive">{form.error}</p>
				{/if}

				<div class="flex gap-2">
					<Button type="submit" class="flex-1">
						{existingCafeId ? 'Open existing cafe' : 'Add cafe'}
					</Button>
					<Button type="button" variant="outline" href="/groups">Cancel</Button>
				</div>
			</form>
		</CardContent>
	</Card>
</div>
