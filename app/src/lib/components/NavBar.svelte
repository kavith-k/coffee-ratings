<script lang="ts">
	import { page } from '$app/state';
	import HouseIcon from '@lucide/svelte/icons/house';
	import RssIcon from '@lucide/svelte/icons/rss';
	import UsersIcon from '@lucide/svelte/icons/users';
	import CircleUserIcon from '@lucide/svelte/icons/circle-user';
	import { isNavActive } from '$lib/utils/nav';

	type Props = { userId: string };
	let { userId }: Props = $props();

	const tabs = $derived([
		{ href: '/', label: 'Home', icon: HouseIcon },
		{ href: '/feed', label: 'Feed', icon: RssIcon },
		{ href: '/groups', label: 'Groups', icon: UsersIcon },
		{ href: `/users/${userId}`, label: 'Profile', icon: CircleUserIcon }
	]);
</script>

<nav
	aria-label="Primary"
	class="bg-background fixed inset-x-0 bottom-0 z-40 flex border-t md:static md:border-t-0 md:border-b md:justify-start md:gap-1 md:px-4 md:py-2"
>
	{#each tabs as tab (tab.href)}
		{@const active = isNavActive(page.url.pathname, tab.href)}
		<a
			href={tab.href}
			aria-current={active ? 'page' : undefined}
			class="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs md:flex-none md:flex-row md:gap-2 md:px-3 {active
				? 'text-primary'
				: 'text-muted-foreground'}"
		>
			<tab.icon class="size-5" aria-hidden="true" />
			<span>{tab.label}</span>
		</a>
	{/each}
</nav>
