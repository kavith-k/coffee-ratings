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

	let { form } = $props();
</script>

<div class="mx-auto max-w-md px-4 py-8">
	<Card>
		<CardHeader>
			<CardTitle>Create a group</CardTitle>
			<CardDescription>
				Friends in this group will be able to see each other's cafe ratings.
			</CardDescription>
		</CardHeader>
		<CardContent>
			<form method="POST" class="grid gap-4">
				<div class="grid gap-2">
					<Label for="name">Group name</Label>
					<Input
						id="name"
						name="name"
						type="text"
						required
						maxlength={100}
						value={form?.name ?? ''}
						placeholder="Morning crew"
					/>
				</div>
				{#if form?.error}
					<p class="text-sm text-destructive">{form.error}</p>
				{/if}
				<div class="flex gap-2">
					<Button type="submit" class="flex-1">Create group</Button>
					<Button type="button" variant="outline" href="/groups">Cancel</Button>
				</div>
			</form>
		</CardContent>
	</Card>
</div>
