<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle,
		DialogTrigger
	} from '$lib/components/ui/dialog/index.js';

	let { data } = $props();

	let copied = $state(false);
	let deleteOpen = $state(false);
	const inviteUrl = $derived(
		typeof window === 'undefined' ? '' : `${window.location.origin}/join/${data.inviteCode}`
	);

	async function copyInviteLink() {
		try {
			await navigator.clipboard.writeText(inviteUrl);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard permission denied -- user can still select the text manually.
		}
	}
</script>

<div class="mx-auto max-w-2xl px-4 py-8">
	<div class="mb-6 flex items-center justify-between gap-4">
		<div>
			<a href="/groups" class="text-sm text-muted-foreground hover:underline">Back to groups</a>
			<h1 class="mt-1 text-2xl font-semibold">{data.group.name}</h1>
		</div>
	</div>

	<Card class="mb-6">
		<CardHeader>
			<CardTitle>Invite link</CardTitle>
			<CardDescription>Share this link with friends to add them to the group.</CardDescription>
		</CardHeader>
		<CardContent class="flex flex-col gap-2 sm:flex-row sm:items-center">
			<code class="flex-1 truncate rounded border bg-muted px-3 py-2 text-xs">{inviteUrl}</code>
			<Button type="button" variant="outline" onclick={copyInviteLink}>
				{copied ? 'Copied' : 'Copy link'}
			</Button>
		</CardContent>
	</Card>

	<Card class="mb-6">
		<CardHeader>
			<CardTitle>Members ({data.members.length})</CardTitle>
		</CardHeader>
		<CardContent>
			<ul class="grid gap-2">
				{#each data.members as member (member.user_id)}
					<li class="flex items-center justify-between gap-2 rounded border p-3">
						<div class="flex items-center gap-2">
							<a href="/users/{member.user_id}" class="font-medium hover:underline">
								{member.display_name}
							</a>
							{#if member.role === 'admin'}
								<Badge variant="secondary">Admin</Badge>
							{/if}
						</div>
						{#if data.isAdmin && member.role !== 'admin'}
							<form method="POST" action="?/removeMember">
								<input type="hidden" name="userId" value={member.user_id} />
								<Button type="submit" variant="outline" size="sm">Remove</Button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		</CardContent>
	</Card>

	<Card>
		<CardHeader>
			<CardTitle>Danger zone</CardTitle>
		</CardHeader>
		<CardContent class="flex flex-col gap-3 sm:flex-row">
			{#if !data.isAdmin}
				<form method="POST" action="?/leaveGroup" class="flex-1">
					<Button type="submit" variant="outline" class="w-full">Leave group</Button>
				</form>
			{/if}
			{#if data.isAdmin}
				<Dialog bind:open={deleteOpen}>
					<DialogTrigger class="flex-1">
						<Button type="button" variant="destructive" class="w-full">Delete group</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Delete {data.group.name}?</DialogTitle>
							<DialogDescription>
								This permanently removes the group and all memberships. Ratings are kept (they
								belong to individual users, not the group), but no one will be able to see each
								other's ratings through this group any more.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button type="button" variant="outline" onclick={() => (deleteOpen = false)}>
								Cancel
							</Button>
							<form method="POST" action="?/deleteGroup">
								<Button type="submit" variant="destructive">Delete group</Button>
							</form>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			{/if}
		</CardContent>
	</Card>
</div>
