<script lang="ts">
	import {
		formatMoney,
		type Account,
		type AccountRecord,
		type DomainIssue,
		type PaymentMode,
		type PaymentRecord
	} from '$lib/domain';
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

	function accountFor(record: AccountRecord): Account | undefined {
		return accounts.find((account) => account.id === record.accountId);
	}

	function paymentFor(record: AccountRecord): PaymentRecord | undefined {
		return snapshot.paymentRecords.find(
			(payment) => payment.liabilityAccountId === record.accountId
		);
	}

	function accountName(accountId: string): string {
		return accounts.find((account) => account.id === accountId)?.name ?? 'Unknown account';
	}

	function modeLabel(mode: PaymentMode): string {
		return mode === 'full-balance'
			? 'Full balance'
			: mode === 'statement-balance'
				? 'Statement balance'
				: 'Custom';
	}
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

	{#if warnings.length > 0}
		<section class="panel receipt-warnings" aria-labelledby="receipt-warnings-title">
			<p class="eyebrow">Saved with real-world messiness</p>
			<h3 id="receipt-warnings-title">Warnings recorded at Stand Up</h3>
			<ul>
				{#each warnings as warning (`${warning.code}:${warning.entityId ?? ''}`)}
					<li>{warning.message}</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="receipt-section" aria-labelledby="receipt-assets-title">
		<div class="stack-heading">
			<div>
				<p class="eyebrow">Opening to final</p>
				<h3 id="receipt-assets-title">Asset snapshots</h3>
			</div>
		</div>
		<div class="receipt-grid">
			{#each snapshot.accountRecords as record (record.id)}
				{@const account = accountFor(record)}
				{#if account?.type === 'asset'}
					<article class="panel receipt-card">
						<h4>{account.name}</h4>
						<dl>
							<div>
								<dt>Opening</dt>
								<dd>{formatMoney(record.openingBalance)}</dd>
							</div>
							<div>
								<dt>Final</dt>
								<dd>{formatMoney(record.finalBalance)}</dd>
							</div>
						</dl>
					</article>
				{/if}
			{/each}
		</div>
	</section>

	<section class="receipt-section" aria-labelledby="receipt-payments-title">
		<div class="stack-heading">
			<div>
				<p class="eyebrow">What was planned</p>
				<h3 id="receipt-payments-title">Liability payments</h3>
			</div>
		</div>
		<div class="receipt-grid payment-receipts">
			{#each snapshot.accountRecords as record (record.id)}
				{@const account = accountFor(record)}
				{@const payment = paymentFor(record)}
				{#if account?.type === 'liability' && payment}
					<article class="panel receipt-card payment-receipt">
						<h4>{account.name}</h4>
						<dl>
							<div>
								<dt>Payment</dt>
								<dd>{formatMoney(payment.paymentAmount)}</dd>
							</div>
							<div>
								<dt>From</dt>
								<dd>{accountName(payment.sourceAssetAccountId)}</dd>
							</div>
							<div>
								<dt>Mode</dt>
								<dd>{modeLabel(payment.paymentMode)}</dd>
							</div>
							<div>
								<dt>Remaining</dt>
								<dd>{formatMoney(payment.remainingAccountBalance)}</dd>
							</div>
							<div>
								<dt>Statement remaining</dt>
								<dd>
									{payment.remainingStatementBalance === null
										? '—'
										: formatMoney(payment.remainingStatementBalance)}
								</dd>
							</div>
							<div>
								<dt>Confirmation</dt>
								<dd>{payment.confirmationId ?? 'Not recorded'}</dd>
							</div>
						</dl>
						{#if payment.notes}<p class="receipt-notes">{payment.notes}</p>{/if}
					</article>
				{/if}
			{/each}
		</div>
	</section>

	<footer class="panel receipt-actions">
		<div>
			<strong>Ready for the next one?</strong>
			<p>A new sit-down starts as its own saved draft with fresh IDs.</p>
			{#if startMessage}<p class="field-error" role="alert">{startMessage}</p>{/if}
		</div>
		<button class="button primary" type="button" disabled={startingNew} onclick={onStartNew}>
			{startingNew ? 'Starting…' : 'Start New Sit-Down'}
		</button>
	</footer>
</section>
