<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount, tick } from 'svelte';
	import AccountHistoryChart from '$lib/components/AccountHistoryChart.svelte';
	import {
		accountIdFromString,
		formatMoney,
		resolveAssetThresholds,
		selectAccountHistory,
		selectActiveAccounts,
		selectArchivedAccounts,
		selectLatestStoodUpState,
		type Account,
		type AccountHistoryDatapoint,
		type AccountId,
		type AccountRecordId,
		type AppSettings,
		type AssetThresholdState,
		type AssetThresholds,
		type Money,
		type PaymentMode
	} from '$lib/domain';
	import {
		createBrowserConfigurationRepository,
		createBrowserSitDownRepository,
		type SitDownSnapshot,
		type StoodUpSitDownSnapshot
	} from '$lib/persistence';

	let settings = $state<AppSettings | null>(null);
	let accounts = $state<Account[]>([]);
	let snapshots = $state<readonly SitDownSnapshot[]>([]);
	let selectedAccountId = $state<AccountId | null>(null);
	let selectedPointId = $state<AccountRecordId | null>(null);
	let detailPanel = $state<HTMLElement>();
	let loading = $state(true);
	let loadError = $state('');

	function isStoodUpSnapshot(snapshot: SitDownSnapshot): snapshot is StoodUpSitDownSnapshot {
		return !snapshot.session.isDraft;
	}

	let completedSnapshots = $derived(snapshots.filter(isStoodUpSnapshot));
	let completedSessions = $derived(completedSnapshots.map((snapshot) => snapshot.session));
	let completedAccountRecords = $derived(
		completedSnapshots.flatMap((snapshot) => snapshot.accountRecords)
	);
	let completedPaymentRecords = $derived(
		completedSnapshots.flatMap((snapshot) => snapshot.paymentRecords)
	);
	let latestState = $derived(
		settings
			? selectLatestStoodUpState({
					settings,
					accounts,
					sessions: completedSessions,
					accountRecords: completedAccountRecords
				})
			: null
	);
	let activeAssets = $derived(selectActiveAccounts(accounts, 'asset'));
	let activeLiabilities = $derived(selectActiveAccounts(accounts, 'liability'));
	let archivedAccounts = $derived(selectArchivedAccounts(accounts));
	let selectedAccount = $derived(
		accounts.find((account) => account.id === selectedAccountId) ?? null
	);
	let history = $derived(
		selectedAccountId
			? selectAccountHistory({
					accountId: selectedAccountId,
					accounts,
					sessions: completedSessions,
					accountRecords: completedAccountRecords,
					paymentRecords: completedPaymentRecords
				})
			: []
	);
	let selectedPoint = $derived(
		history.find((point) => point.accountRecordId === selectedPointId) ?? null
	);
	let selectedThresholds = $derived.by((): AssetThresholds | null => {
		if (!settings || selectedAccount?.type !== 'asset') return null;
		const result = resolveAssetThresholds(
			settings.defaultAssetThresholds,
			selectedAccount.thresholdPolicy
		);
		return result.ok ? result.value : null;
	});

	onMount(() => {
		void loadWhiteboard();
	});

	async function loadWhiteboard(): Promise<void> {
		loading = true;
		loadError = '';
		try {
			const configurationRepository = createBrowserConfigurationRepository();
			const sitDownRepository = createBrowserSitDownRepository();
			const [configuration, storedSnapshots] = await Promise.all([
				configurationRepository.loadConfiguration(),
				sitDownRepository.listSessions()
			]);
			settings = configuration.settings;
			accounts = [...configuration.accounts];
			snapshots = storedSnapshots;
			selectedAccountId = requestedAccountId() ?? defaultAccountId();
			if (selectedAccountId) updateAccountQuery(selectedAccountId);
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'The Whiteboard could not be opened.';
		} finally {
			loading = false;
		}
	}

	function requestedAccountId(): AccountId | null {
		const rawId = page.url.searchParams.get('account');
		if (!rawId) return null;
		try {
			const accountId = accountIdFromString(rawId);
			return accounts.some((account) => account.id === accountId) ? accountId : null;
		} catch {
			return null;
		}
	}

	function defaultAccountId(): AccountId | null {
		const ordered = [...activeAssets, ...activeLiabilities, ...archivedAccounts];
		const withHistory = ordered.find(
			(account) =>
				selectAccountHistory({
					accountId: account.id,
					accounts,
					sessions: completedSessions,
					accountRecords: completedAccountRecords,
					paymentRecords: completedPaymentRecords
				}).length > 0
		);
		return withHistory?.id ?? ordered[0]?.id ?? null;
	}

	function updateAccountQuery(accountId: AccountId): void {
		replaceState(resolve(`/whiteboard/?account=${encodeURIComponent(accountId)}`), page.state);
	}

	function selectAccount(accountId: AccountId): void {
		selectedAccountId = accountId;
		selectedPointId = null;
		updateAccountQuery(accountId);
	}

	function handleAccountChange(event: Event): void {
		try {
			selectAccount(accountIdFromString((event.currentTarget as HTMLSelectElement).value));
		} catch {
			selectedAccountId = defaultAccountId();
		}
	}

	async function selectPoint(accountRecordId: AccountRecordId): Promise<void> {
		selectedPointId = accountRecordId;
		await tick();
		detailPanel?.focus();
	}

	function formatSitDownDate(value: string): string {
		return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(
			new Date(value + 'T12:00:00')
		);
	}

	function optionalMoney(value: Money | null): string {
		return value === null ? 'Not recorded' : formatMoney(value);
	}

	function paymentModeLabel(mode: PaymentMode): string {
		return mode === 'full-balance'
			? 'Full balance'
			: mode === 'statement-balance'
				? 'Statement balance'
				: mode === 'custom'
					? 'Custom'
					: 'No payment';
	}

	function sourceAssetLabel(payment: NonNullable<AccountHistoryDatapoint['payment']>): string {
		return payment.sourceAssetAccountName ?? 'No source — not paying';
	}

	function thresholdLabel(state: AssetThresholdState): string {
		return state === 'none'
			? 'No thresholds'
			: state === 'healthy'
				? 'Healthy'
				: state === 'warning'
					? 'Warning'
					: 'Danger';
	}

	function pointButtonLabel(point: AccountHistoryDatapoint): string {
		return 'View details for ' + point.accountName + ' on ' + point.sitDownDate;
	}
</script>

<svelte:head><title>Visit Whiteboard - Stashy</title></svelte:head>

<section class="page-intro whiteboard-intro">
	<div>
		<p class="eyebrow">Latest state and saved history</p>
		<h1>Visit Whiteboard</h1>
		<p>See the latest stood-up snapshot, then trace any account through exact saved sessions.</p>
	</div>
	<a class="button secondary" href={resolve('/sit-down/')}>Open Sit Down</a>
</section>

{#if loading}
	<section class="panel loading-panel" aria-live="polite">
		<h2>Opening the Whiteboard…</h2>
		<p>Stashy is arranging completed snapshots from this browser.</p>
	</section>
{:else if loadError}
	<section class="panel error-panel" role="alert">
		<h2>The Whiteboard could not open.</h2>
		<p>{loadError}</p>
		<button class="button secondary" type="button" onclick={loadWhiteboard}>Try again</button>
	</section>
{:else if accounts.length === 0}
	<section class="panel empty-state">
		<p class="eyebrow">No accounts yet</p>
		<h2>The Whiteboard needs something to follow.</h2>
		<p>Add the assets and liabilities used during a sit-down before building account history.</p>
		<a class="button primary" href={resolve('/configuration/accounts/')}>Set up accounts</a>
	</section>
{:else}
	<section class="whiteboard-latest" aria-labelledby="latest-state-title">
		<div class="stack-heading">
			<div>
				<p class="eyebrow">Where am I now?</p>
				<h2 id="latest-state-title">Latest stood-up state</h2>
			</div>
			{#if latestState}
				<div class="latest-as-of">
					<span>As of</span>
					<strong>{formatSitDownDate(latestState.sitDownDate)}</strong>
					<a
						href={resolve(`/archive/session/?session=${encodeURIComponent(latestState.sessionId)}`)}
						>View source session</a
					>
				</div>
			{/if}
		</div>

		{#if !latestState}
			<div class="panel whiteboard-empty">
				<h3>No stood-up snapshot yet.</h3>
				<p>
					Drafts stay off the Whiteboard. Stand up a completed session to establish the latest
					state.
				</p>
				<a class="button primary" href={resolve('/sit-down/')}>Continue Sit Down</a>
			</div>
		{:else}
			<div class="latest-state-groups">
				<section aria-labelledby="latest-assets-title">
					<h3 id="latest-assets-title">Assets</h3>
					<div class="latest-state-grid">
						{#each latestState.assets as asset (asset.accountRecordId)}
							<article class="panel latest-state-card asset-state {asset.thresholdState}">
								<header>
									<h4>{asset.accountName}</h4>
									<span class="balance-status">{thresholdLabel(asset.thresholdState)}</span>
								</header>
								{#if asset.archived}<span class="archive-status">Archived account</span>{/if}
								<span>Final balance</span>
								<strong>{formatMoney(asset.finalBalance)}</strong>
							</article>
						{:else}
							<p class="muted-note">No asset records were saved in this session.</p>
						{/each}
					</div>
				</section>

				<section aria-labelledby="latest-liabilities-title">
					<h3 id="latest-liabilities-title">Liabilities</h3>
					<div class="latest-state-grid">
						{#each latestState.liabilities as liability (liability.accountRecordId)}
							<article class="panel latest-state-card liability-state">
								<header>
									<h4>{liability.accountName}</h4>
								</header>
								{#if liability.archived}<span class="archive-status">Archived account</span>{/if}
								<span>Final balance</span>
								<strong>{formatMoney(liability.finalBalance)}</strong>
								<small>Statement remaining: {optionalMoney(liability.finalStatementBalance)}</small>
							</article>
						{:else}
							<p class="muted-note">No liability records were saved in this session.</p>
						{/each}
					</div>
				</section>
			</div>
		{/if}
	</section>

	<section class="account-history-section" aria-labelledby="account-history-title">
		<div class="history-heading">
			<div>
				<p class="eyebrow">How has it changed?</p>
				<h2 id="account-history-title">Account history</h2>
			</div>
			<label class="account-history-picker">
				<span>Account</span>
				<select value={selectedAccountId ?? ''} onchange={handleAccountChange}>
					{#if activeAssets.length > 0}
						<optgroup label="Active assets">
							{#each activeAssets as account (account.id)}
								<option value={account.id}>{account.name}</option>
							{/each}
						</optgroup>
					{/if}
					{#if activeLiabilities.length > 0}
						<optgroup label="Active liabilities">
							{#each activeLiabilities as account (account.id)}
								<option value={account.id}>{account.name}</option>
							{/each}
						</optgroup>
					{/if}
					{#if archivedAccounts.length > 0}
						<optgroup label="Archived accounts">
							{#each archivedAccounts as account (account.id)}
								<option value={account.id}>{account.name}</option>
							{/each}
						</optgroup>
					{/if}
				</select>
			</label>
		</div>

		{#if selectedAccount}
			<div class="selected-account-heading">
				<div>
					<h3>{selectedAccount.name}</h3>
					<p>{selectedAccount.type === 'asset' ? 'Asset account' : 'Liability account'}</p>
				</div>
				{#if selectedAccount.archived}<span class="archive-status">Archived account</span>{/if}
			</div>

			{#if history.length === 0}
				<div class="panel whiteboard-empty account-history-empty">
					<h3>No stood-up history for this account.</h3>
					<p>Stashy will add a point when this account appears in a completed sit-down.</p>
				</div>
			{:else}
				<section class="panel chart-panel" aria-labelledby="balance-chart-title">
					<div class="chart-heading">
						<div>
							<h3 id="balance-chart-title">Final balance over time</h3>
							<p>Select a point or use the table below to inspect its exact snapshot.</p>
						</div>
						<span class="count-badge"
							>{history.length} {history.length === 1 ? 'point' : 'points'}</span
						>
					</div>
					<AccountHistoryChart
						accountName={selectedAccount.name}
						points={history}
						thresholds={selectedThresholds}
						selectedAccountRecordId={selectedPointId}
						onSelect={(accountRecordId) => void selectPoint(accountRecordId)}
					/>
					{#if selectedThresholds}
						<p class="threshold-note">
							Threshold lines use current settings: warning below
							<strong>{formatMoney(selectedThresholds.warningBelow)}</strong> and danger below
							<strong>{formatMoney(selectedThresholds.dangerBelow)}</strong>.
						</p>
					{/if}
				</section>

				{#if selectedPoint}
					<section
						class="panel history-point-detail"
						bind:this={detailPanel}
						tabindex="-1"
						aria-labelledby="history-point-title"
					>
						<header>
							<div>
								<p class="eyebrow">Selected snapshot</p>
								<h3 id="history-point-title">{formatSitDownDate(selectedPoint.sitDownDate)}</h3>
							</div>
							<button class="text-button" type="button" onclick={() => (selectedPointId = null)}
								>Close</button
							>
						</header>
						<dl class="history-detail-grid">
							<div>
								<dt>Opening balance</dt>
								<dd>{formatMoney(selectedPoint.openingBalance)}</dd>
							</div>
							<div>
								<dt>Final balance</dt>
								<dd>{formatMoney(selectedPoint.finalBalance)}</dd>
							</div>
							{#if selectedPoint.accountType === 'liability'}
								<div>
									<dt>Opening statement</dt>
									<dd>{optionalMoney(selectedPoint.openingStatementBalance)}</dd>
								</div>
								<div>
									<dt>Final statement</dt>
									<dd>{optionalMoney(selectedPoint.finalStatementBalance)}</dd>
								</div>
							{/if}
							{#if selectedPoint.payment}
								<div>
									<dt>Payment</dt>
									<dd>{formatMoney(selectedPoint.payment.paymentAmount)}</dd>
								</div>
								<div>
									<dt>Mode</dt>
									<dd>{paymentModeLabel(selectedPoint.payment.paymentMode)}</dd>
								</div>
								<div>
									<dt>Source asset</dt>
									<dd>{sourceAssetLabel(selectedPoint.payment)}</dd>
								</div>
								<div>
									<dt>Confirmation ID</dt>
									<dd>{selectedPoint.payment.confirmationId ?? 'Not recorded'}</dd>
								</div>
							{/if}
						</dl>
						{#if selectedPoint.payment}
							<div class="history-notes">
								<strong>Notes</strong>
								<p>{selectedPoint.payment.notes ?? 'No notes recorded.'}</p>
							</div>
						{/if}
						<a
							class="button secondary"
							href={resolve(
								`/archive/session/?session=${encodeURIComponent(selectedPoint.sessionId)}`
							)}>View source session</a
						>
					</section>
				{/if}

				<section class="history-table-section" aria-labelledby="history-table-title">
					<div class="stack-heading">
						<div>
							<p class="eyebrow">Exact saved values</p>
							<h3 id="history-table-title">History table</h3>
						</div>
					</div>
					<div class="history-table-wrap">
						<table class="history-table">
							<thead>
								<tr>
									<th scope="col">Sit-down date</th>
									<th scope="col">Opening</th>
									<th scope="col">Final</th>
									<th scope="col">Payment</th>
									<th scope="col"><span class="sr-only">Actions</span></th>
								</tr>
							</thead>
							<tbody>
								{#each history as point (point.accountRecordId)}
									<tr class:history-row-selected={point.accountRecordId === selectedPointId}>
										<td data-label="Sit-down date">{point.sitDownDate}</td>
										<td data-label="Opening">{formatMoney(point.openingBalance)}</td>
										<td data-label="Final">{formatMoney(point.finalBalance)}</td>
										<td data-label="Payment"
											>{point.payment ? formatMoney(point.payment.paymentAmount) : '—'}</td
										>
										<td data-label="Action">
											<button
												class="button compact secondary"
												type="button"
												aria-label={pointButtonLabel(point)}
												onclick={() => void selectPoint(point.accountRecordId)}>View details</button
											>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</section>
			{/if}
		{/if}
	</section>
{/if}
