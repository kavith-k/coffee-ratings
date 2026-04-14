<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as InputOTP from '$lib/components/ui/input-otp/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';

	let { data } = $props();
	let email = $state('');
	let otp = $state('');
	let loading = $state(false);
	let error = $state('');
	let codeSent = $state(false);

	const next = $derived(data.next);

	async function handleSendCode(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';

		const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`;

		const { error: err } = await data.supabase.auth.signInWithOtp({
			email,
			options: { emailRedirectTo: redirectTo }
		});

		if (err) {
			error = err.message;
		} else {
			codeSent = true;
		}

		loading = false;
	}

	async function handleVerifyCode() {
		loading = true;
		error = '';

		const { error: err } = await data.supabase.auth.verifyOtp({
			email,
			token: otp,
			type: 'email'
		});

		if (err) {
			error = err.message;
		} else {
			goto(next ?? '/');
		}

		loading = false;
	}

	function handleBack() {
		codeSent = false;
		otp = '';
		error = '';
	}
</script>

<div class="flex min-h-svh items-center justify-center px-4">
	<Card class="w-full max-w-sm">
		<CardHeader class="text-center">
			<CardTitle class="text-2xl">Coffee Ratings</CardTitle>
			<CardDescription>
				{#if codeSent}
					Enter the 6-digit code sent to {email}
				{:else}
					Sign in with your email to continue
				{/if}
			</CardDescription>
		</CardHeader>
		<CardContent>
			{#if !codeSent}
				<form onsubmit={handleSendCode} class="grid gap-4">
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
						{loading ? 'Sending...' : 'Send sign-in code'}
					</Button>
				</form>
			{:else}
				<div class="grid gap-4">
					<div class="flex justify-center">
						<InputOTP.Root maxlength={6} bind:value={otp} onComplete={handleVerifyCode}>
							{#snippet children({ cells })}
								<InputOTP.Group>
									{#each cells.slice(0, 3) as cell (cell)}
										<InputOTP.Slot {cell} />
									{/each}
								</InputOTP.Group>
								<InputOTP.Separator />
								<InputOTP.Group>
									{#each cells.slice(3, 6) as cell (cell)}
										<InputOTP.Slot {cell} />
									{/each}
								</InputOTP.Group>
							{/snippet}
						</InputOTP.Root>
					</div>
					<Button
						class="h-11 w-full md:h-10"
						disabled={loading || otp.length < 6}
						onclick={handleVerifyCode}
					>
						{loading ? 'Verifying...' : 'Verify code'}
					</Button>
					<div class="relative flex items-center justify-center">
						<Separator class="absolute w-full" />
						<span class="bg-card text-muted-foreground relative px-2 text-xs">or</span>
					</div>
					<Button variant="ghost" class="h-11 w-full md:h-10" onclick={handleBack}>
						Use a different email
					</Button>
				</div>
			{/if}
			{#if error}
				<p class="mt-4 text-center text-sm text-destructive">{error}</p>
			{/if}
		</CardContent>
	</Card>
</div>
