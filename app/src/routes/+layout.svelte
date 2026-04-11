<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { invalidate } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import NavBar from '$lib/components/NavBar.svelte';

	let { data, children } = $props();

	const session = $derived(data.session);
	const user = $derived(data.user);
	const shouldShowNav = $derived(
		!!session &&
			!!user &&
			!page.url.pathname.startsWith('/auth/') &&
			!page.url.pathname.startsWith('/join/')
	);

	$effect(() => {
		const {
			data: { subscription }
		} = data.supabase.auth.onAuthStateChange((_event, session) => {
			if (session?.expires_at !== data.session?.expires_at) {
				invalidate('supabase:auth');
			}
		});

		return () => subscription.unsubscribe();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if navigating.to}
	<div
		class="fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse bg-primary"
		aria-hidden="true"
	></div>
{/if}

<div class={shouldShowNav ? 'pb-20 md:pb-0' : ''}>
	{@render children()}
</div>

{#if shouldShowNav && user}
	<NavBar userId={user.id} />
{/if}
