<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { Database } from '$lib/supabase/types';
	import { Input } from '$lib/components/ui/input/index.js';

	type Suggestion = {
		id: string;
		name: string;
		area: string | null;
		lat: number | null;
		lng: number | null;
	};

	let {
		supabase,
		value = $bindable(''),
		onSelect
	}: {
		supabase: SupabaseClient<Database>;
		value?: string;
		onSelect: (cafe: Suggestion | null) => void;
	} = $props();

	let suggestions = $state<Suggestion[]>([]);
	let loading = $state(false);
	let open = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	async function runSearch(query: string) {
		loading = true;
		const { data, error } = await supabase.rpc('search_cafes', {
			query,
			result_limit: 10
		});
		loading = false;
		if (error || !data) {
			suggestions = [];
			return;
		}
		suggestions = data.map((row) => ({
			id: row.id,
			name: row.name,
			area: row.area,
			lat: row.lat,
			lng: row.lng
		}));
	}

	function handleInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		value = input.value;
		// A new name means the user is no longer pointing at a known cafe.
		onSelect(null);
		open = true;

		if (debounceTimer) clearTimeout(debounceTimer);
		const trimmed = value.trim();
		if (trimmed.length < 2) {
			suggestions = [];
			return;
		}
		debounceTimer = setTimeout(() => runSearch(trimmed), 300);
	}

	function pick(s: Suggestion) {
		value = s.name;
		suggestions = [];
		open = false;
		onSelect(s);
	}

	function handleBlur() {
		// Close the dropdown after a short delay so click events on
		// suggestions have a chance to fire before the list unmounts.
		setTimeout(() => (open = false), 150);
	}
</script>

<div class="relative">
	<Input
		type="text"
		name="name"
		placeholder="Cafe name"
		required
		autocomplete="off"
		{value}
		oninput={handleInput}
		onfocus={() => (open = suggestions.length > 0)}
		onblur={handleBlur}
	/>

	{#if open && suggestions.length > 0}
		<ul
			class="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-md"
		>
			{#each suggestions as suggestion (suggestion.id)}
				<li>
					<button
						type="button"
						class="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent"
						onclick={() => pick(suggestion)}
					>
						<span class="font-medium">{suggestion.name}</span>
						{#if suggestion.area}
							<span class="text-xs text-muted-foreground">{suggestion.area}</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if loading}
		<p class="mt-1 text-xs text-muted-foreground">Searching…</p>
	{/if}
</div>
