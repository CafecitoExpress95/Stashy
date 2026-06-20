<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
</script>

<svelte:head><title>Visit Whiteboard - Stashy</title></svelte:head>

<EmptyState
	eyebrow="Phase 6"
	title="The wider view comes after the records."
	description="Whiteboard will summarize the latest stood-up session and show saved balance history for active and archived accounts. Drafts will stay out of the dashboard."
	actionHref="/configuration/accounts/"
	actionLabel="Review accounts"
/>
