<script lang="ts">
	import {
		formatMoney,
		assessDraftProjection,
		type Account,
		type DraftAccountRecord,
		type DraftPaymentRecord,
		type Money,
		type PaymentMode,
		type PaymentRecord
	} from '$lib/domain';
	import type { SitDownSnapshot, SitDownDraftSnapshot } from '$lib/persistence';

	type Props = {
		snapshot: SitDownSnapshot;
		accounts: readonly Account[];
	};

	let { snapshot, accounts }: Props = $props();
	let draftProjection = $derived.by(() => {
		if (!snapshot.session.isDraft) return null;
		const draft = snapshot as SitDownDraftSnapshot;
		return assessDraftProjection({
			sessionId: draft.session.id,
			accounts,
			accountRecords: draft.accountRecords,
			paymentRecords: draft.paymentRecords
		});
	});

	function accountName(accountId: string | undefined): string {
		return accountId
			? (accounts.find((account) => account.id === accountId)?.name ?? 'Unknown account')
			: 'No source selected';
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
				<p class="eyebrow">
					{snapshot.session.isDraft ? 'Draft running balances' : 'Opening to final'}
				</p>
				<h2 id="replay-assets-title">Asset snapshots</h2>
			</div>
		</div>
		{#if draftProjection?.paymentExclusions.length}
			<p class="projection-warning">Incomplete — payments excluded</p>
		{/if}
		<div class="receipt-grid">
			{#each snapshot.accountRecords as record (record.id)}
				{@const account = accountFor(record)}
				{#if account?.type === 'asset'}
					{@const assessment = draftProjection?.assetProjections.find(
						(asset) => asset.accountId === record.accountId
					)}
					{@const draftBalance = draftProjection?.projectedAssetBalances?.find(
						(asset) => asset.accountId === record.accountId
					)?.projectedFinalBalance}
					<article class="panel receipt-card">
						<h3>{account.name}</h3>
						{#if account.archived}<span class="archive-status">Archived account</span>{/if}
						<dl>
							<div>
								<dt>Opening</dt>
								<dd>{money(record.openingBalance)}</dd>
							</div>
							<div>
								<dt>{snapshot.session.isDraft ? 'Running balance' : 'Final'}</dt>
								<dd>
									{money(
										snapshot.session.isDraft ? draftBalance : record.finalBalance,
										'Not calculated'
									)}
								</dd>
							</div>
						</dl>
						{#if assessment?.completeness === 'partial'}
							<p class="projection-explanation">Partial — payments excluded.</p>
						{:else if assessment?.completeness === 'unavailable'}
							<p class="projection-explanation">
								{record.openingBalance === undefined
									? 'Opening balance needed.'
									: 'Running balance unavailable — record errors.'}
							</p>
						{/if}
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
								<dd>
									{payment.paymentMode === 'no-payment'
										? 'No source — not paying'
										: accountName(payment.sourceAssetAccountId)}
								</dd>
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
						{#if draftProjection?.paymentExclusions.some((row) => row.paymentId === payment.id)}
							<p class="projection-explanation">Payment excluded from running balances.</p>
						{/if}
					</article>
				{/if}
			{/each}
		</div>
	</section>
</div>
