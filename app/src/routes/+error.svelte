<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';

	let title = $derived.by(() => {
		if (page.status === 404) return 'Not found';
		if (page.status === 403) return 'Not allowed';
		return 'Something went wrong';
	});

	let description = $derived(
		page.error?.message ?? 'We hit an unexpected issue.'
	);
</script>

<div class="flex min-h-svh items-center justify-center px-4">
	<Card class="w-full max-w-sm">
		<CardHeader class="text-center">
			<CardTitle class="text-2xl">{title}</CardTitle>
			<CardDescription>{description}</CardDescription>
		</CardHeader>
		<CardContent class="grid gap-4">
			{#if page.error?.errorId}
				<p class="text-muted-foreground text-center text-xs">
					Error id: {page.error.errorId}
				</p>
			{/if}
			<Button href="/" class="w-full">Back home</Button>
		</CardContent>
	</Card>
</div>
