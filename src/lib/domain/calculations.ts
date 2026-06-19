import type { AccountId } from './identity';
import { createIssue, type DomainIssue, type DomainResult } from './issues';
import { subtractMoney, ZERO_MONEY, type Money } from './money';
import type { DraftPaymentRecord, PaymentRecord } from './types';

export interface AssetOpeningBalance {
	readonly accountId: AccountId;
	readonly openingBalance: Money;
}

export interface ProjectedAssetBalance extends AssetOpeningBalance {
	readonly projectedFinalBalance: Money;
}

export function calculatePayment(record: DraftPaymentRecord): DomainResult<PaymentRecord> {
	const errors: DomainIssue[] = [];

	if (!record.sourceAssetAccountId) {
		errors.push(
			createIssue(
				'error',
				'missing-source-asset',
				'Choose the asset account paying this liability.',
				{
					entityId: record.id,
					field: 'sourceAssetAccountId'
				}
			)
		);
	}
	if (!record.paymentMode) {
		errors.push(
			createIssue(
				'error',
				'missing-payment-mode',
				'Choose how this payment amount is determined.',
				{
					entityId: record.id,
					field: 'paymentMode'
				}
			)
		);
	}
	if (record.startingAccountBalance === undefined) {
		errors.push(
			createIssue(
				'error',
				'missing-starting-account-balance',
				'Enter the starting account balance.',
				{ entityId: record.id, field: 'startingAccountBalance' }
			)
		);
	}
	if (record.startingStatementBalance === undefined) {
		errors.push(
			createIssue(
				'error',
				'missing-starting-statement-balance',
				'Enter the starting statement balance.',
				{ entityId: record.id, field: 'startingStatementBalance' }
			)
		);
	}
	if (record.paymentMode === 'custom' && record.customPaymentAmount === undefined) {
		errors.push(
			createIssue('error', 'missing-custom-payment-amount', 'Enter the custom payment amount.', {
				entityId: record.id,
				field: 'customPaymentAmount'
			})
		);
	}

	if (
		errors.length > 0 ||
		!record.sourceAssetAccountId ||
		!record.paymentMode ||
		record.startingAccountBalance === undefined ||
		record.startingStatementBalance === undefined
	) {
		return { ok: false, errors };
	}

	let paymentAmount: Money;
	switch (record.paymentMode) {
		case 'full-balance':
			paymentAmount = record.startingAccountBalance;
			break;
		case 'statement-balance':
			paymentAmount = record.startingStatementBalance;
			break;
		case 'custom':
			if (record.customPaymentAmount === undefined) {
				return {
					ok: false,
					errors: [
						createIssue(
							'error',
							'missing-custom-payment-amount',
							'Enter the custom payment amount.',
							{ entityId: record.id, field: 'customPaymentAmount' }
						)
					]
				};
			}
			paymentAmount = record.customPaymentAmount;
			break;
	}

	return {
		ok: true,
		value: {
			id: record.id,
			createdAt: record.createdAt,
			updatedAt: record.updatedAt,
			sessionId: record.sessionId,
			liabilityAccountId: record.liabilityAccountId,
			sourceAssetAccountId: record.sourceAssetAccountId,
			paymentMode: record.paymentMode,
			paymentAmount,
			startingAccountBalance: record.startingAccountBalance,
			startingStatementBalance: record.startingStatementBalance,
			remainingAccountBalance: subtractMoney(record.startingAccountBalance, paymentAmount),
			remainingStatementBalance:
				record.paymentMode === 'custom'
					? subtractMoney(record.startingStatementBalance, paymentAmount)
					: ZERO_MONEY,
			confirmationId: record.confirmationId,
			notes: record.notes
		}
	};
}

export function calculateProjectedAssetBalances(
	assets: readonly AssetOpeningBalance[],
	payments: readonly PaymentRecord[]
): DomainResult<readonly ProjectedAssetBalance[]> {
	const errors: DomainIssue[] = [];
	const seenLiabilities = new Set<string>();

	for (const payment of payments) {
		if (seenLiabilities.has(payment.liabilityAccountId)) {
			errors.push(
				createIssue(
					'error',
					'duplicate-liability-payment',
					'Only one payment can be recorded for a liability in the same sit-down.',
					{ entityId: payment.id, field: 'liabilityAccountId' }
				)
			);
		}
		seenLiabilities.add(payment.liabilityAccountId);
	}

	const projectedByAsset = new Map<string, ProjectedAssetBalance>();
	for (const asset of assets) {
		projectedByAsset.set(asset.accountId, {
			...asset,
			projectedFinalBalance: asset.openingBalance
		});
	}

	for (const payment of payments) {
		const asset = projectedByAsset.get(payment.sourceAssetAccountId);
		if (!asset) {
			errors.push(
				createIssue(
					'error',
					'invalid-source-asset',
					'The selected source asset is not available in this sit-down.',
					{ entityId: payment.id, field: 'sourceAssetAccountId' }
				)
			);
			continue;
		}

		projectedByAsset.set(payment.sourceAssetAccountId, {
			...asset,
			projectedFinalBalance: subtractMoney(asset.projectedFinalBalance, payment.paymentAmount)
		});
	}

	if (errors.length > 0) {
		return { ok: false, errors };
	}

	return {
		ok: true,
		value: assets.map((asset) => projectedByAsset.get(asset.accountId)!)
	};
}
