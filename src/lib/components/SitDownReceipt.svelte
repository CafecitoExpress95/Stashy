<script lang="ts">
	import SessionReplayDetails from '$lib/components/SessionReplayDetails.svelte';
	import type { Account, DomainIssue } from '$lib/domain';
	import type { StoodUpSitDownSnapshot } from '$lib/persistence';

	type Props = {
		snapshot: StoodUpSitDownSnapshot;
		accounts: readonly Account[];
		warnings: readonly DomainIssue[];
		startingNew: boolean;
		startMessage: string;
		onStartNew: () => void;
	};

	let { snapshot, accounts, warnings, startingNew, startMessage, onStartNew }: Props = $props();
</script>

<section class="completion-receipt" aria-labelledby="receipt-title">
	<header class="receipt-hero panel">
		<div>
			<p class="eyebrow">Saved locally</p>
			<h2 id="receipt-title">You stood up.</h2>
			<p>
				The {snapshot.session.sitDownDate} sit-down is stored as a completed snapshot in this browser.
			</p>
		</div>
		<div class="receipt-seal" aria-label="Stood up session">Stood up</div>
	</header>

	<section class="panel receipt-actions" aria-label="Next sit-down">
		<div>
			<strong>Ready for the next one?</strong>
			<p>A new sit-down starts as its own saved draft with fresh IDs.</p>
			{#if startMessage}<p class="field-error" role="alert">{startMessage}</p>{/if}
		</div>
		<button class="button primary" type="button" disabled={startingNew} onclick={onStartNew}>
			{startingNew ? 'Starting…' : 'Start New Sit-Down'}
		</button>
	</section>

	{#if warnings.length > 0}
		<section class="panel receipt-warnings" aria-labelledby="receipt-warnings-title">
			<p class="eyebrow">Saved with real-world messiness</p>
			<h3 id="receipt-warnings-title">Warnings recorded at Stand Up</h3>
			<ul>
				{#each warnings as warning (warning.code + ':' + (warning.entityId ?? ''))}
					<li>{warning.message}</li>
				{/each}
			</ul>
		</section>
	{/if}

	<SessionReplayDetails {snapshot} {accounts} />
</section>
