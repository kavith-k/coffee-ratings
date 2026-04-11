<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardFooter,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';

	let { data } = $props();

	const loginHref = $derived(
		`/auth/login?next=${encodeURIComponent(`/join/${data.inviteCode ?? ''}`)}`
	);
</script>

<div class="flex min-h-svh items-center justify-center px-4">
	<Card class="w-full max-w-sm">
		{#if data.authenticated && 'error' in data && data.error}
			<CardHeader>
				<CardTitle>Something went wrong</CardTitle>
				<CardDescription>{data.error}</CardDescription>
			</CardHeader>
			<CardFooter>
				<Button href="/groups" class="w-full">Back to groups</Button>
			</CardFooter>
		{:else if !data.authenticated && data.groupPreview}
			<CardHeader class="text-center">
				<CardTitle class="text-2xl">You're invited</CardTitle>
				<CardDescription>
					Join <span class="font-semibold">{data.groupPreview.name}</span>
					on Coffee Ratings
				</CardDescription>
			</CardHeader>
			<CardContent class="text-center text-sm text-muted-foreground">
				{data.groupPreview.member_count}
				{data.groupPreview.member_count === 1 ? 'member' : 'members'} already rating cafes together.
			</CardContent>
			<CardFooter>
				<Button href={loginHref} class="w-full">Sign in to join</Button>
			</CardFooter>
		{:else if !data.authenticated}
			<CardHeader>
				<CardTitle>Invalid invite link</CardTitle>
				<CardDescription>
					This invite link is not valid. Ask the person who sent it for a fresh one.
				</CardDescription>
			</CardHeader>
		{/if}
	</Card>
</div>
