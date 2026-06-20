<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import AppShell from '$lib/components/AppShell.svelte';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Stashy</title>
</svelte:head>

<AppShell>{@render children()}</AppShell>
