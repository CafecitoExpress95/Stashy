<script lang="ts">
	import { asset } from '$app/paths';
	import AppShell from '$lib/components/AppShell.svelte';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/png" sizes="100x100" href={asset('/favicon.png')} />
	<link rel="apple-touch-icon" href={asset('/favicon.png')} />
	<meta name="theme-color" content="#8b3d05" />
	<title>Stashy</title>
</svelte:head>

<AppShell>{@render children()}</AppShell>
