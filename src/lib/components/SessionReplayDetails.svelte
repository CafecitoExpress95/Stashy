<script lang="ts">
	import {
		formatMoney,
		type Account,
		type DraftAccountRecord,
		type DraftPaymentRecord,
		type Money,
		type PaymentMode,
		type PaymentRecord
	} from '$lib/domain';
	import type { SitDownSnapshot } from '$lib/persistence';

	type Props = {
		snapshot: SitDownSnapshot;
		accounts: readonly Account[];
	};

	let { snapshot, accounts }: Props = $props();

	function accountName(accountId: string | undefined): string {
		return accountId
			? (accounts.find((account) => account.id === accountId)?.name ?? 'Unknown account')
			: 'No source — not paying';
	}

	function accountFor(record: DraftAccountRecord): Account | undefined {
		return accounts.find((account) => account.id === record.accountId);
	}

	type ReplayPayment = DraftPaymentRecord | PaymentRecord;

	function paymentFor(record: DraftAccountRecord): ReplayPayment | undefined {
		return snapshot.paymentRecords.find(
			(payment) => payment.liabilityAccountId === record.accountId
		);
	}

	function money(value: Money | null | undefined, missing = 'Not entered'): string {
		return value === undefined ? missing : value === null ? '—' : formatMoney(value);
	}

	function modeLabel(mode: PaymentMode | undefined): string {
		return mode === 'full-balance'
			? 'Full balance'
			: mode === 'statement-balance'
				? 'Statement balance'
				: mode === 'custom'
					? 'Custom'
					: mode === 'no-payment'
						? 'No payment'
						: 'Not selected';
	}

	function paymentAmount(payment: ReplayPayment): string {
		if ('paymentAmount' in payment) return formatMoney(payment.paymentAmount);
		if (payment.paymentMode === 'custom' && payment.customPaymentAmount !== undefined) {
			return formatMoney(payment.customPaymentAmount);
		}
		return 'Not calculated';
	}
</script>

<div class="session-replay-details">
	<section class="receipt-section" aria-labelledby="replay-assets-title">
		<div class="stack-heading">
			<div>
				<p class="eyebrow">Opening to final</p>
				<h2 id="replay-assets-title">Asset snapshots</h2>
			</div>
		</div>
		<div class="receipt-grid">
			{#each snapshot.accountRecords as record (record.id)}
				{@const account = accountFor(record)}
				{#if account?.type === 'asset'}
					<article class="panel receipt-card">
						<h3>{account.name}</h3>
						{#if account.archived}<span class="archive-status">Archived account</span>{/if}
						<dl>
							<div>
								<dt>Opening</dt>
								<dd>{money(record.openingBalance)}</dd>
							</div>
							<div>
								<dt>Final</dt>
								<dd>{money(record.finalBalance, 'Not calculated')}</dd>
							</div>
						</dl>
					</article>
				{/if}
			{/each}
		</div>
	</section>

	<section class="receipt-section" aria-labelledby="replay-payments-title">
		<div class="stack-heading">
			<div>
				<p class="eyebrow">What was planned</p>
				<h2 id="replay-payments-title">Liability payments</h2>
			</div>
		</div>
		<div class="receipt-grid payment-receipts">
			{#each snapshot.accountRecords as record (record.id)}
				{@const account = accountFor(record)}
				{@const payment = paymentFor(record)}
				{#if account?.type === 'liability' && payment}
					<article class="panel receipt-card payment-receipt">
						<h3>{account.name}</h3>
						{#if account.archived}<span class="archive-status">Archived account</span>{/if}
						<dl>
							<div>
								<dt>Opening account</dt>
								<dd>{money(payment.startingAccountBalance)}</dd>
							</div>
							<div>
								<dt>Opening statement</dt>
								<dd>{money(payment.startingStatementBalance)}</dd>
							</div>
							<div>
								<dt>Payment</dt>
								<dd>{paymentAmount(payment)}</dd>
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
								<dt>Remaining account</dt>
								<dd>
									{'remainingAccountBalance' in payment
										? money(payment.remainingAccountBalance)
										: money(record.finalBalance, 'Not calculated')}
								</dd>
							</div>
							<div>
								<dt>Remaining statement</dt>
								<dd>
									{'remainingStatementBalance' in payment
										? money(payment.remainingStatementBalance)
										: money(record.finalStatementBalance, 'Not calculated')}
								</dd>
							</div>
							<div>
								<dt>Confirmation</dt>
								<dd>{payment.confirmationId ?? 'Not recorded'}</dd>
							</div>
						</dl>
						<div class="replay-notes">
							<strong>Notes</strong>
							<p>{payment.notes ?? 'No notes recorded.'}</p>
						</div>
					</article>
				{/if}
			{/each}
		</div>
	</section>
</div>
