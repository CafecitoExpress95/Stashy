<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { formatMoney, selectArchiveSessionSummaries, type Account } from '$lib/domain';
	import {
		createBrowserConfigurationRepository,
		createBrowserSitDownRepository,
		type SitDownSnapshot
	} from '$lib/persistence';

	let accounts = $state<Account[]>([]);
	let snapshots = $state<readonly SitDownSnapshot[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let summaries = $derived(selectArchiveSessionSummaries(snapshots, accounts));

	onMount(() => {
		void loadArchive();
	});

	async function loadArchive(): Promise<void> {
		loading = true;
		loadError = '';
		try {
			const configurationRepository = createBrowserConfigurationRepository();
			const sitDownRepository = createBrowserSitDownRepository();
			const [configuration, storedSnapshots] = await Promise.all([
				configurationRepository.loadConfiguration(),
				sitDownRepository.listSessions()
			]);
			accounts = [...configuration.accounts];
			snapshots = storedSnapshots;
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'The Archive could not be opened.';
		} finally {
			loading = false;
		}
	}

	function savedTime(timestamp: string): string {
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(timestamp));
	}
</script>

<svelte:head><title>Check Archive - Stashy</title></svelte:head>

<section class="page-intro archive-intro">
	<div>
		<p class="eyebrow">Saved sit-downs</p>
		<h1>Check Archive</h1>
		<p>Replay what happened, then choose Edit only when a saved session needs correction.</p>
	</div>
	<a class="button primary" href={resolve('/sit-down/')}>Open Sit Down</a>
</section>

{#if loading}
	<section class="panel loading-panel" aria-live="polite">
		<h2>Opening the Archive…</h2>
		<p>Stashy is collecting the saved snapshots in this browser.</p>
	</section>
{:else if loadError}
	<section class="panel error-panel" role="alert">
		<h2>The Archive could not open.</h2>
		<p>{loadError}</p>
		<button class="button secondary" type="button" onclick={loadArchive}>Try again</button>
	</section>
{:else if summaries.length === 0}
	<section class="panel empty-state">
		<p class="eyebrow">Nothing saved yet</p>
		<h2>Your first sit-down will land here.</h2>
		<p>Drafts and stood-up sessions will appear from newest date to oldest.</p>
		<a class="button primary" href={resolve('/sit-down/')}>Start a sit-down</a>
	</section>
{:else}
	<section class="archive-list-section" aria-labelledby="archive-list-title">
		<div class="stack-heading">
			<div>
				<p class="eyebrow">Newest first</p>
				<h2 id="archive-list-title">Saved sessions</h2>
			</div>
			<span class="count-badge">{summaries.length}</span>
		</div>
		<div class="session-archive-list">
			{#each summaries as summary (summary.sessionId)}
				<a
					class="panel session-archive-card"
					href={resolve(`/archive/session/?session=${encodeURIComponent(summary.sessionId)}`)}
				>
					<header>
						<div>
							<p class="eyebrow">Sit-down date</p>
							<h3>{summary.sitDownDate}</h3>
						</div>
						<span class:session-draft={summary.isDraft} class:session-complete={!summary.isDraft}>
							{summary.isDraft ? 'Draft' : 'Stood up'}
						</span>
					</header>
					<dl class="archive-summary-grid">
						<div>
							<dt>Last saved</dt>
							<dd>{savedTime(summary.updatedAt)}</dd>
						</div>
						<div>
							<dt>Payments</dt>
							<dd>{summary.paymentCount}</dd>
						</div>
						<div>
							<dt>Payment total</dt>
							<dd>
								{summary.totalPaymentAmount === null
									? 'Incomplete draft'
									: formatMoney(summary.totalPaymentAmount)}
							</dd>
						</div>
					</dl>
					<p class="archive-account-preview">
						{summary.liabilityNames.join(', ')}{summary.remainingLiabilityCount > 0
							? ' and ' + summary.remainingLiabilityCount + ' more'
							: ''}
					</p>
					<span class="card-kicker">Replay session →</span>
				</a>
			{/each}
		</div>
	</section>
{/if}
