<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { invalidate } from '$app/navigation';

	let { data, children } = $props();

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
{@render children()}
