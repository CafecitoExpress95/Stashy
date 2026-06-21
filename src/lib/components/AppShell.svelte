<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const navigation = [
		{ href: '/', label: 'Home' },
		{ href: '/sit-down/', label: 'Sit Down' },
		{ href: '/archive/', label: 'Check Archive' },
		{ href: '/whiteboard/', label: 'Visit Whiteboard' },
		{ href: '/configuration/accounts/', label: 'Accounts' },
		{ href: '/configuration/data/', label: 'Save & Restore' }
	] as const;

	function isCurrent(href: string): boolean {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<meta
		name="description"
		content="Stashy is a local-first payment sit-down workspace for safer, faster planning."
	/>
</svelte:head>

<div class="app-frame">
	<header class="app-header">
		<a class="brand" href={resolve('/')} aria-label="Stashy home">
			<img
				class="brand-mark"
				src={asset('/logo.png')}
				alt=""
				width="980"
				height="899"
				decoding="async"
			/>
			<span>
				<strong>Stashy</strong>
				<small>Payment sit-downs, without spreadsheet dread.</small>
			</span>
		</a>

		<nav aria-label="Primary navigation">
			{#each navigation as item (item.href)}
				<a href={resolve(item.href)} aria-current={isCurrent(item.href) ? 'page' : undefined}>
					{item.label}
				</a>
			{/each}
		</nav>
	</header>

	<main id="main-content">
		{@render children()}
	</main>

	<footer>
		<span>Local-first by design.</span>
		<span>Your balances stay in this browser.</span>
	</footer>
</div>
