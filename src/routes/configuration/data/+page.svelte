<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
</script>

<svelte:head><title>Save & Restore - Stashy</title></svelte:head>

<EmptyState
	eyebrow="Phase 7"
	title="Backups arrive before the real-data trial."
	description="This area will export every account, draft, session, snapshot, and audit entry, then validate a full restore before replacing local data."
	actionHref="/configuration/accounts/"
	actionLabel="Configure accounts"
/>
