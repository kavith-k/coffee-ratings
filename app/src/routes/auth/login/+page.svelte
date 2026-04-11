<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';

	let { data } = $props();
	let email = $state('');
	let loading = $state(false);
	let message = $state('');
	let error = $state('');

	async function handleLogin(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';
		message = '';

		const next = data.next;
		const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`;

		const { error: err } = await data.supabase.auth.signInWithOtp({
			email,
			options: { emailRedirectTo: redirectTo }
		});

		if (err) {
			error = err.message;
		} else {
			message = 'Check your email for a magic link to sign in.';
		}

		loading = false;
	}
</script>

<div class="flex min-h-svh items-center justify-center px-4">
	<Card class="w-full max-w-sm">
		<CardHeader class="text-center">
			<CardTitle class="text-2xl">Coffee Ratings</CardTitle>
			<CardDescription>Sign in with your email to continue</CardDescription>
		</CardHeader>
		<CardContent>
			<form onsubmit={handleLogin} class="grid gap-4">
				<div class="grid gap-2">
					<Label for="email">Email</Label>
					<Input
						id="email"
						type="email"
						placeholder="you@example.com"
						required
						bind:value={email}
					/>
				</div>
				<Button type="submit" class="h-11 w-full md:h-10" disabled={loading}>
					{loading ? 'Sending...' : 'Send magic link'}
				</Button>
				{#if message}
					<p class="text-sm text-muted-foreground text-center">{message}</p>
				{/if}
				{#if error}
					<p class="text-sm text-destructive text-center">{error}</p>
				{/if}
			</form>
		</CardContent>
	</Card>
</div>
