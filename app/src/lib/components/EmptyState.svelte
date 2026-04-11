<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';

	let {
		title,
		message,
		actionLabel,
		actionHref
	}: {
		title?: string;
		message: string;
		actionLabel?: string;
		actionHref?: string;
	} = $props();
</script>

<div class="rounded-lg border border-dashed p-8 text-center">
	{#if title}
		<h2 class="mb-2 text-lg font-semibold">{title}</h2>
	{/if}
	<p class="text-sm text-muted-foreground">{message}</p>
	{#if actionLabel && actionHref}
		<div class="mt-4">
			<Button href={actionHref}>{actionLabel}</Button>
		</div>
	{/if}
</div>
