<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
</script>

<svelte:head><title>Check Archive - Stashy</title></svelte:head>

<EmptyState
	eyebrow="Phase 5"
	title="Nothing to replay yet."
	description="Saved sit-downs will appear here from newest to oldest, with full session replay and history-safe editing."
	actionHref="/"
	actionLabel="Back home"
/>
