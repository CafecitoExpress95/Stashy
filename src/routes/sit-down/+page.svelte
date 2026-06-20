<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
</script>

<svelte:head><title>Sit Down - Stashy</title></svelte:head>

<EmptyState
	eyebrow="Phase 3"
	title="The cockpit is the next stop."
	description="Soon this is where opening balances, one payment per liability, and immediate projected asset balances will come together. Configure your accounts first so the cockpit opens with the right rows in the right order."
	actionHref="/configuration/accounts/"
	actionLabel="Configure accounts"
/>
