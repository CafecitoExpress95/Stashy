<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import SessionReplayDetails from '$lib/components/SessionReplayDetails.svelte';
	import { sessionIdFromString, type Account } from '$lib/domain';
	import {
		createBrowserConfigurationRepository,
		createBrowserSitDownRepository,
		type SitDownSnapshot
	} from '$lib/persistence';

	let accounts = $state<Account[]>([]);
	let snapshot = $state<SitDownSnapshot | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let notFound = $state(false);

	onMount(() => {
		void loadReplay();
	});

	async function loadReplay(): Promise<void> {
		loading = true;
		loadError = '';
		notFound = false;
		try {
			const rawId = page.url.searchParams.get('session');
			if (!rawId) {
				loadError = 'Choose a saved session from the Archive to replay it.';
				return;
			}
			let sessionId;
			try {
				sessionId = sessionIdFromString(rawId);
			} catch {
				loadError =
					'That session address is malformed. Return to the Archive and choose a saved session.';
				return;
			}
			const configurationRepository = createBrowserConfigurationRepository();
			const sitDownRepository = createBrowserSitDownRepository();
			const [configuration, storedSnapshot] = await Promise.all([
				configurationRepository.loadConfiguration(),
				sitDownRepository.loadSession(sessionId)
			]);
			accounts = [...configuration.accounts];
			if (!storedSnapshot) {
				notFound = true;
				return;
			}
			snapshot = storedSnapshot;
		} catch (error) {
			loadError =
				error instanceof Error ? error.message : 'This saved session could not be replayed.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>Session Replay - Stashy</title></svelte:head>

{#if loading}
	<section class="panel loading-panel" aria-live="polite">
		<h1>Opening session replay…</h1>
	</section>
{:else if loadError}
	<section class="panel error-panel" role="alert">
		<p class="eyebrow">Replay unavailable</p>
		<h1>This session could not open.</h1>
		<p>{loadError}</p>
		<a class="button primary" href={resolve('/archive/')}>Back to Archive</a>
	</section>
{:else if notFound}
	<section class="panel empty-state">
		<p class="eyebrow">Session not found</p>
		<h1>That session is not in the stash.</h1>
		<p>It may have been removed outside Stashy or the address may be out of date.</p>
		<a class="button primary" href={resolve('/archive/')}>Back to Archive</a>
	</section>
{:else if snapshot}
	{#if page.url.searchParams.get('saved') === '1'}
		<div class="panel correction-success" role="status">Corrections saved with an audit trail.</div>
	{/if}
	<section class="page-intro replay-intro">
		<div>
			<p class="eyebrow">Read-only replay</p>
			<h1>{snapshot.session.sitDownDate} sit-down</h1>
			<p>These are the exact snapshots currently stored for this session.</p>
		</div>
		<div class="replay-actions">
			<span
				class:session-draft={snapshot.session.isDraft}
				class:session-complete={!snapshot.session.isDraft}
			>
				{snapshot.session.isDraft ? 'Draft' : 'Stood up'}
			</span>
			<a class="button secondary" href={resolve('/archive/')}>Back to Archive</a>
			<a
				class="button primary"
				href={resolve(`/sit-down/?session=${encodeURIComponent(snapshot.session.id)}`)}
				>Edit Session</a
			>
		</div>
	</section>
	<SessionReplayDetails {snapshot} {accounts} />
{/if}
