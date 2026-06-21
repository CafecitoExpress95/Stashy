/** Payment resolution and projected source-asset calculations. */
import type { AccountId } from './identity';
import { createIssue, type DomainIssue, type DomainResult } from './issues';
import { subtractMoney, ZERO_MONEY, type Money } from './money';
import type { DraftPaymentRecord, PaymentRecord } from './types';

/** The user-entered opening balance for an asset in the current sit-down. */
export type AssetOpeningBalance = {
	readonly accountId: AccountId;
	readonly openingBalance: Money;
};

/** An asset opening balance composed with its payment-adjusted result. */
export type ProjectedAssetBalance = AssetOpeningBalance & {
	readonly projectedFinalBalance: Money;
};

type CalculationReadyPayment =
	| (DraftPaymentRecord & {
			readonly sourceAssetAccountId: AccountId;
			readonly paymentMode: 'full-balance';
			readonly startingAccountBalance: Money;
	  })
	| (DraftPaymentRecord & {
			readonly sourceAssetAccountId: AccountId;
			readonly paymentMode: 'statement-balance';
			readonly startingAccountBalance: Money;
			readonly startingStatementBalance: Money;
	  })
	| (DraftPaymentRecord & {
			readonly sourceAssetAccountId: AccountId;
			readonly paymentMode: 'custom';
			readonly customPaymentAmount: Money;
			readonly startingAccountBalance: Money;
	  });

function getPaymentCompletenessErrors(record: DraftPaymentRecord): DomainIssue[] {
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
				{
					entityId: record.id,
					field: 'startingAccountBalance'
				}
			)
		);
	}

	if (record.paymentMode === 'statement-balance' && record.startingStatementBalance === undefined) {
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

	return errors;
}

function resolvePaymentAmount(record: CalculationReadyPayment): Money {
	switch (record.paymentMode) {
		case 'full-balance':
			return record.startingAccountBalance;
		case 'statement-balance':
			return record.startingStatementBalance;
		case 'custom':
			return record.customPaymentAmount;
	}
}

function buildPaymentRecord(record: CalculationReadyPayment, paymentAmount: Money): PaymentRecord {
	const startingStatementBalance = record.startingStatementBalance ?? null;
	const statementDifference =
		startingStatementBalance === null
			? null
			: subtractMoney(startingStatementBalance, paymentAmount);
	const remainingStatementBalance =
		statementDifference === null || statementDifference > ZERO_MONEY
			? statementDifference
			: ZERO_MONEY;

	return {
		id: record.id,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		sessionId: record.sessionId,
		liabilityAccountId: record.liabilityAccountId,
		sourceAssetAccountId: record.sourceAssetAccountId,
		paymentMode: record.paymentMode,
		paymentAmount,
		startingAccountBalance: record.startingAccountBalance,
		startingStatementBalance,
		remainingAccountBalance: subtractMoney(record.startingAccountBalance, paymentAmount),
		remainingStatementBalance,
		confirmationId: record.confirmationId,
		notes: record.notes
	};
}

/**
 * Resolves a complete draft payment into the balances that will be saved.
 * Missing calculation fields are returned together instead of failing one at a time.
 */
export function calculatePayment(record: DraftPaymentRecord): DomainResult<PaymentRecord> {
	const errors = getPaymentCompletenessErrors(record);
	if (errors.length > 0) {
		return { ok: false, errors };
	}

	// The checks above establish the required-field union for the calculation helpers.
	const readyPayment = record as CalculationReadyPayment;
	const paymentAmount = resolvePaymentAmount(readyPayment);

	return {
		ok: true,
		value: buildPaymentRecord(readyPayment, paymentAmount)
	};
}

function getProjectionErrors(
	assets: readonly AssetOpeningBalance[],
	payments: readonly PaymentRecord[]
): DomainIssue[] {
	const errors: DomainIssue[] = [];
	const seenLiabilityIds = new Set<AccountId>();
	const availableAssetIds = new Set(assets.map((asset) => asset.accountId));

	for (const payment of payments) {
		if (seenLiabilityIds.has(payment.liabilityAccountId)) {
			errors.push(
				createIssue(
					'error',
					'duplicate-liability-payment',
					'Only one payment can be recorded for a liability in the same sit-down.',
					{ entityId: payment.id, field: 'liabilityAccountId' }
				)
			);
		}
		seenLiabilityIds.add(payment.liabilityAccountId);

		if (!availableAssetIds.has(payment.sourceAssetAccountId)) {
			errors.push(
				createIssue(
					'error',
					'invalid-source-asset',
					'The selected source asset is not available in this sit-down.',
					{ entityId: payment.id, field: 'sourceAssetAccountId' }
				)
			);
		}
	}

	return errors;
}

/**
 * Subtracts every complete payment from its selected source asset.
 * Any duplicate liability or unavailable source makes the whole projection untrusted.
 */
export function calculateProjectedAssetBalances(
	assets: readonly AssetOpeningBalance[],
	payments: readonly PaymentRecord[]
): DomainResult<readonly ProjectedAssetBalance[]> {
	const errors = getProjectionErrors(assets, payments);
	if (errors.length > 0) {
		// Validate before subtracting so duplicate rows are never applied even temporarily.
		return { ok: false, errors };
	}

	const projectedBalancesByAssetId = new Map<AccountId, ProjectedAssetBalance>();
	for (const asset of assets) {
		projectedBalancesByAssetId.set(asset.accountId, {
			...asset,
			projectedFinalBalance: asset.openingBalance
		});
	}

	for (const payment of payments) {
		const asset = projectedBalancesByAssetId.get(payment.sourceAssetAccountId);
		if (!asset) {
			throw new Error('Projection source validation and calculation are out of sync.');
		}

		projectedBalancesByAssetId.set(payment.sourceAssetAccountId, {
			...asset,
			projectedFinalBalance: subtractMoney(asset.projectedFinalBalance, payment.paymentAmount)
		});
	}

	return {
		ok: true,
		value: assets.map((asset) => {
			const projectedAsset = projectedBalancesByAssetId.get(asset.accountId);
			if (!projectedAsset) {
				throw new Error('Every opening asset must have a projected balance.');
			}
			return projectedAsset;
		})
	};
}
