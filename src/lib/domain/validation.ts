import {
	calculatePayment,
	calculateProjectedAssetBalances,
	type AssetOpeningBalance,
	type ProjectedAssetBalance
} from './calculations';
import { createIssue, type DomainIssue, type DomainIssueSeverity } from './issues';
import { ZERO_MONEY } from './money';
import type {
	Account,
	DraftAccountRecord,
	DraftPaymentRecord,
	PaymentRecord,
	Session
} from './types';

export interface SessionValidationInput {
	readonly session: Session;
	readonly accounts: readonly Account[];
	readonly accountRecords: readonly DraftAccountRecord[];
	readonly paymentRecords: readonly DraftPaymentRecord[];
}

export interface SessionValidationResult {
	readonly isValid: boolean;
	readonly issues: readonly DomainIssue[];
	readonly errors: readonly DomainIssue[];
	readonly warnings: readonly DomainIssue[];
	readonly calculatedPayments: readonly PaymentRecord[];
	readonly projectedAssetBalances: readonly ProjectedAssetBalance[] | null;
}

function validateSession(
	input: SessionValidationInput,
	missingFieldSeverity: DomainIssueSeverity
): SessionValidationResult {
	const issues: DomainIssue[] = [];
	const calculatedPayments: PaymentRecord[] = [];
	const accountsById = new Map(input.accounts.map((account) => [account.id, account]));
	const accountRecordsByAccountId = new Map(
		input.accountRecords.map((record) => [record.accountId, record])
	);

	for (const record of input.accountRecords) {
		if (record.sessionId !== input.session.id) {
			issues.push(
				createIssue(
					'error',
					'session-reference-mismatch',
					'This account snapshot belongs to a different sit-down.',
					{ entityId: record.id, field: 'sessionId' }
				)
			);
		}

		if (!accountsById.has(record.accountId)) {
			issues.push(
				createIssue(
					'error',
					'invalid-account-reference',
					'This account snapshot refers to an account that does not exist.',
					{ entityId: record.id, field: 'accountId' }
				)
			);
		}

		if (record.openingBalance === undefined) {
			issues.push(
				createIssue(missingFieldSeverity, 'missing-opening-balance', 'Enter the opening balance.', {
					entityId: record.id,
					field: 'openingBalance'
				})
			);
		}

		if (record.finalBalance === undefined) {
			issues.push(
				createIssue(missingFieldSeverity, 'missing-final-balance', 'Enter the final balance.', {
					entityId: record.id,
					field: 'finalBalance'
				})
			);
		}
	}

	const duplicatePaymentIds = findDuplicatePaymentIds(input.paymentRecords);
	for (const duplicatePaymentId of duplicatePaymentIds) {
		issues.push(
			createIssue(
				'error',
				'duplicate-liability-payment',
				'Only one payment can be recorded for a liability in the same sit-down.',
				{ entityId: duplicatePaymentId, field: 'liabilityAccountId' }
			)
		);
	}

	let allPaymentsComplete = duplicatePaymentIds.size === 0;

	for (const record of input.paymentRecords) {
		if (record.sessionId !== input.session.id) {
			issues.push(
				createIssue(
					'error',
					'session-reference-mismatch',
					'This payment belongs to a different sit-down.',
					{ entityId: record.id, field: 'sessionId' }
				)
			);
		}

		const liabilityAccount = accountsById.get(record.liabilityAccountId);
		if (!liabilityAccount || liabilityAccount.type !== 'liability') {
			issues.push(
				createIssue(
					'error',
					'invalid-liability-account',
					'This payment must refer to an existing liability account.',
					{ entityId: record.id, field: 'liabilityAccountId' }
				)
			);
		}

		if (record.sourceAssetAccountId) {
			const sourceAsset = accountsById.get(record.sourceAssetAccountId);
			if (!sourceAsset || sourceAsset.type !== 'asset') {
				issues.push(
					createIssue(
						'error',
						'invalid-source-asset',
						'The selected payment source must be an existing asset account.',
						{ entityId: record.id, field: 'sourceAssetAccountId' }
					)
				);
			} else {
				const sourceRecord = accountRecordsByAccountId.get(record.sourceAssetAccountId);
				if (!sourceRecord || sourceRecord.openingBalance === undefined) {
					issues.push(
						createIssue(
							missingFieldSeverity,
							'missing-source-asset-balance',
							'Enter the source asset opening balance before trusting its projection.',
							{ entityId: record.id, field: 'sourceAssetAccountId' }
						)
					);
					allPaymentsComplete = false;
				}
			}
		}

		const calculation = calculatePayment(record);
		if (!calculation.ok) {
			allPaymentsComplete = false;
			for (const error of calculation.errors) {
				issues.push({
					...error,
					severity: isMissingFieldIssue(error) ? missingFieldSeverity : error.severity
				});
			}
			continue;
		}

		calculatedPayments.push(calculation.value);
		issues.push(...getPaymentWarnings(calculation.value));
	}

	let projectedAssetBalances: readonly ProjectedAssetBalance[] | null = null;
	if (allPaymentsComplete && calculatedPayments.length === input.paymentRecords.length) {
		const assetOpenings: AssetOpeningBalance[] = [];
		for (const record of input.accountRecords) {
			const account = accountsById.get(record.accountId);
			if (account?.type === 'asset' && record.openingBalance !== undefined) {
				assetOpenings.push({
					accountId: record.accountId,
					openingBalance: record.openingBalance
				});
			}
		}

		const projection = calculateProjectedAssetBalances(assetOpenings, calculatedPayments);
		if (projection.ok) {
			projectedAssetBalances = projection.value;
			for (const asset of projection.value) {
				if (asset.projectedFinalBalance < ZERO_MONEY) {
					issues.push(
						createIssue(
							'warning',
							'negative-projected-asset-balance',
							'Projected asset balance is below $0.00.',
							{ entityId: asset.accountId, field: 'projectedFinalBalance' }
						)
					);
				} else if (asset.projectedFinalBalance === ZERO_MONEY) {
					issues.push(
						createIssue(
							'warning',
							'zero-projected-asset-balance',
							'Projected asset balance is $0.00.',
							{ entityId: asset.accountId, field: 'projectedFinalBalance' }
						)
					);
				}
			}
		} else {
			issues.push(...projection.errors);
		}
	}

	const errors = issues.filter((issue) => issue.severity === 'error');
	const warnings = issues.filter((issue) => issue.severity === 'warning');

	return {
		isValid: errors.length === 0,
		issues,
		errors,
		warnings,
		calculatedPayments,
		projectedAssetBalances
	};
}

function findDuplicatePaymentIds(
	records: readonly DraftPaymentRecord[]
): ReadonlySet<DraftPaymentRecord['id']> {
	const firstPaymentByLiability = new Map<string, DraftPaymentRecord['id']>();
	const duplicateIds = new Set<DraftPaymentRecord['id']>();

	for (const record of records) {
		const firstId = firstPaymentByLiability.get(record.liabilityAccountId);
		if (firstId) {
			duplicateIds.add(firstId);
			duplicateIds.add(record.id);
		} else {
			firstPaymentByLiability.set(record.liabilityAccountId, record.id);
		}
	}

	return duplicateIds;
}

function isMissingFieldIssue(issue: DomainIssue): boolean {
	return (
		issue.code === 'missing-source-asset' ||
		issue.code === 'missing-payment-mode' ||
		issue.code === 'missing-custom-payment-amount' ||
		issue.code === 'missing-starting-account-balance' ||
		issue.code === 'missing-starting-statement-balance'
	);
}

function getPaymentWarnings(payment: PaymentRecord): readonly DomainIssue[] {
	const warnings: DomainIssue[] = [];

	if (payment.paymentAmount < ZERO_MONEY) {
		warnings.push(
			createIssue(
				'warning',
				'negative-payment',
				'Payment is below $0.00; check whether this is intentional.',
				{ entityId: payment.id, field: 'paymentAmount' }
			)
		);
	}
	if (payment.paymentAmount > payment.startingAccountBalance) {
		warnings.push(
			createIssue(
				'warning',
				'payment-exceeds-account-balance',
				'Payment exceeds the starting account balance.',
				{ entityId: payment.id, field: 'paymentAmount' }
			)
		);
	}
	if (payment.remainingAccountBalance < ZERO_MONEY) {
		warnings.push(
			createIssue(
				'warning',
				'negative-remaining-account-balance',
				'Remaining account balance is below $0.00.',
				{ entityId: payment.id, field: 'remainingAccountBalance' }
			)
		);
	}
	if (payment.remainingStatementBalance < ZERO_MONEY) {
		warnings.push(
			createIssue(
				'warning',
				'negative-remaining-statement-balance',
				'Remaining statement balance is below $0.00.',
				{ entityId: payment.id, field: 'remainingStatementBalance' }
			)
		);
	}

	return warnings;
}

export function validateDraftSession(input: SessionValidationInput): SessionValidationResult {
	return validateSession(input, 'warning');
}

export function validateStandUpSession(input: SessionValidationInput): SessionValidationResult {
	return validateSession(input, 'error');
}
