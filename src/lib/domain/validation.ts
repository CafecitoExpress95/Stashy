/** Draft and stand-up validation for a complete sit-down. */
import {
	calculatePayment,
	calculateProjectedAssetBalances,
	type AssetOpeningBalance,
	type ProjectedAssetBalance
} from './calculations';
import type { AccountId } from './identity';
import {
	createIssue,
	type DomainIssue,
	type DomainIssueCode,
	type DomainIssueSeverity
} from './issues';
import { ZERO_MONEY } from './money';
import type {
	Account,
	DraftAccountRecord,
	DraftPaymentRecord,
	PaymentRecord,
	Session
} from './types';

/** All records needed to validate one session without storage or UI dependencies. */
export type SessionValidationInput = {
	readonly session: Session;
	readonly accounts: readonly Account[];
	readonly accountRecords: readonly DraftAccountRecord[];
	readonly paymentRecords: readonly DraftPaymentRecord[];
};

/** Validation issues plus any calculations that are safe to show or save. */
export type SessionValidationResult = {
	readonly isValid: boolean;
	readonly issues: readonly DomainIssue[];
	readonly errors: readonly DomainIssue[];
	readonly warnings: readonly DomainIssue[];
	readonly resolvedPayments: readonly PaymentRecord[];
	readonly projectedAssetBalances: readonly ProjectedAssetBalance[] | null;
};

type ValidationLookups = {
	readonly accountsById: ReadonlyMap<AccountId, Account>;
	readonly accountRecordsByAccountId: ReadonlyMap<AccountId, DraftAccountRecord>;
};

type PaymentValidationOutcome = {
	readonly issues: readonly DomainIssue[];
	readonly resolvedPayments: readonly PaymentRecord[];
	readonly canBuildTrustedProjection: boolean;
};

const CALCULATION_FIELD_ISSUE_CODES = new Set<DomainIssueCode>([
	'missing-source-asset',
	'missing-payment-mode',
	'missing-custom-payment-amount',
	'missing-starting-account-balance',
	'missing-starting-statement-balance'
]);

function createValidationLookups(input: SessionValidationInput): ValidationLookups {
	return {
		accountsById: new Map(input.accounts.map((account) => [account.id, account])),
		accountRecordsByAccountId: new Map(
			input.accountRecords.map((record) => [record.accountId, record])
		)
	};
}

function validateAccountRecords(
	input: SessionValidationInput,
	lookups: ValidationLookups,
	missingFieldSeverity: DomainIssueSeverity
): DomainIssue[] {
	const issues: DomainIssue[] = [];

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

		if (!lookups.accountsById.has(record.accountId)) {
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

	return issues;
}

function findDuplicatePaymentIds(
	records: readonly DraftPaymentRecord[]
): ReadonlySet<DraftPaymentRecord['id']> {
	const firstPaymentByLiabilityId = new Map<AccountId, DraftPaymentRecord['id']>();
	const duplicatePaymentIds = new Set<DraftPaymentRecord['id']>();

	for (const record of records) {
		const firstPaymentId = firstPaymentByLiabilityId.get(record.liabilityAccountId);
		if (firstPaymentId) {
			// Flag both rows so the cockpit can point to every conflicting payment.
			duplicatePaymentIds.add(firstPaymentId);
			duplicatePaymentIds.add(record.id);
		} else {
			firstPaymentByLiabilityId.set(record.liabilityAccountId, record.id);
		}
	}

	return duplicatePaymentIds;
}

function getDuplicatePaymentIssues(
	duplicatePaymentIds: ReadonlySet<DraftPaymentRecord['id']>
): DomainIssue[] {
	return [...duplicatePaymentIds].map((paymentId) =>
		createIssue(
			'error',
			'duplicate-liability-payment',
			'Only one payment can be recorded for a liability in the same sit-down.',
			{ entityId: paymentId, field: 'liabilityAccountId' }
		)
	);
}

function usesCalculationField(issue: DomainIssue): boolean {
	return CALCULATION_FIELD_ISSUE_CODES.has(issue.code);
}

function applyMissingFieldSeverity(
	issue: DomainIssue,
	missingFieldSeverity: DomainIssueSeverity
): DomainIssue {
	return usesCalculationField(issue) ? { ...issue, severity: missingFieldSeverity } : issue;
}

function validatePaymentReference(
	record: DraftPaymentRecord,
	input: SessionValidationInput,
	lookups: ValidationLookups,
	missingFieldSeverity: DomainIssueSeverity
): { readonly issues: DomainIssue[]; readonly sourceOpeningIsAvailable: boolean } {
	const issues: DomainIssue[] = [];
	let sourceOpeningIsAvailable = true;

	if (record.sessionId !== input.session.id) {
		issues.push(
			createIssue(
				'error',
				'session-reference-mismatch',
				'This payment belongs to a different sit-down.',
				{
					entityId: record.id,
					field: 'sessionId'
				}
			)
		);
	}

	const liabilityAccount = lookups.accountsById.get(record.liabilityAccountId);
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
		const sourceAsset = lookups.accountsById.get(record.sourceAssetAccountId);
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
			const sourceRecord = lookups.accountRecordsByAccountId.get(record.sourceAssetAccountId);
			if (!sourceRecord || sourceRecord.openingBalance === undefined) {
				issues.push(
					createIssue(
						missingFieldSeverity,
						'missing-source-asset-balance',
						'Enter the source asset opening balance before trusting its projection.',
						{ entityId: record.id, field: 'sourceAssetAccountId' }
					)
				);
				sourceOpeningIsAvailable = false;
			}
		}
	}

	return { issues, sourceOpeningIsAvailable };
}

function validatePaymentRecords(
	input: SessionValidationInput,
	lookups: ValidationLookups,
	missingFieldSeverity: DomainIssueSeverity,
	hasDuplicatePayments: boolean
): PaymentValidationOutcome {
	const issues: DomainIssue[] = [];
	const resolvedPayments: PaymentRecord[] = [];
	let canBuildTrustedProjection = !hasDuplicatePayments;

	for (const record of input.paymentRecords) {
		const referenceValidation = validatePaymentReference(
			record,
			input,
			lookups,
			missingFieldSeverity
		);
		issues.push(...referenceValidation.issues);
		if (!referenceValidation.sourceOpeningIsAvailable) {
			canBuildTrustedProjection = false;
		}

		const calculation = calculatePayment(record);
		if (!calculation.ok) {
			canBuildTrustedProjection = false;
			issues.push(
				...calculation.errors.map((issue) => applyMissingFieldSeverity(issue, missingFieldSeverity))
			);
			continue;
		}

		resolvedPayments.push(calculation.value);
		issues.push(...getPaymentWarnings(calculation.value));
	}

	return { issues, resolvedPayments, canBuildTrustedProjection };
}

function getAssetOpeningBalances(
	input: SessionValidationInput,
	lookups: ValidationLookups
): AssetOpeningBalance[] {
	const assetOpenings: AssetOpeningBalance[] = [];

	for (const record of input.accountRecords) {
		const account = lookups.accountsById.get(record.accountId);
		if (account?.type === 'asset' && record.openingBalance !== undefined) {
			assetOpenings.push({
				accountId: record.accountId,
				openingBalance: record.openingBalance
			});
		}
	}

	return assetOpenings;
}

function getProjectedAssetWarnings(
	projectedBalances: readonly ProjectedAssetBalance[]
): DomainIssue[] {
	const warnings: DomainIssue[] = [];

	for (const asset of projectedBalances) {
		if (asset.projectedFinalBalance < ZERO_MONEY) {
			warnings.push(
				createIssue(
					'warning',
					'negative-projected-asset-balance',
					'Projected asset balance is below $0.00.',
					{ entityId: asset.accountId, field: 'projectedFinalBalance' }
				)
			);
		} else if (asset.projectedFinalBalance === ZERO_MONEY) {
			warnings.push(
				createIssue(
					'warning',
					'zero-projected-asset-balance',
					'Projected asset balance is $0.00.',
					{ entityId: asset.accountId, field: 'projectedFinalBalance' }
				)
			);
		}
	}

	return warnings;
}

function calculateTrustedProjection(
	input: SessionValidationInput,
	lookups: ValidationLookups,
	paymentValidation: PaymentValidationOutcome
): {
	readonly projectedAssetBalances: readonly ProjectedAssetBalance[] | null;
	readonly issues: readonly DomainIssue[];
} {
	const everyPaymentResolved =
		paymentValidation.resolvedPayments.length === input.paymentRecords.length;
	if (!paymentValidation.canBuildTrustedProjection || !everyPaymentResolved) {
		return { projectedAssetBalances: null, issues: [] };
	}

	const assetOpenings = getAssetOpeningBalances(input, lookups);
	const projection = calculateProjectedAssetBalances(
		assetOpenings,
		paymentValidation.resolvedPayments
	);
	if (!projection.ok) {
		return { projectedAssetBalances: null, issues: projection.errors };
	}

	return {
		projectedAssetBalances: projection.value,
		issues: getProjectedAssetWarnings(projection.value)
	};
}

function getPaymentWarnings(payment: PaymentRecord): DomainIssue[] {
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

function validateSession(
	input: SessionValidationInput,
	missingFieldSeverity: DomainIssueSeverity
): SessionValidationResult {
	const lookups = createValidationLookups(input);
	const duplicatePaymentIds = findDuplicatePaymentIds(input.paymentRecords);
	const accountRecordIssues = validateAccountRecords(input, lookups, missingFieldSeverity);
	const duplicatePaymentIssues = getDuplicatePaymentIssues(duplicatePaymentIds);
	const paymentValidation = validatePaymentRecords(
		input,
		lookups,
		missingFieldSeverity,
		duplicatePaymentIds.size > 0
	);
	const projection = calculateTrustedProjection(input, lookups, paymentValidation);

	// Keep a stable, human-readable order: snapshots, duplicates, payments, projection.
	const issues = [
		...accountRecordIssues,
		...duplicatePaymentIssues,
		...paymentValidation.issues,
		...projection.issues
	];
	const errors = issues.filter((issue) => issue.severity === 'error');
	const warnings = issues.filter((issue) => issue.severity === 'warning');

	return {
		isValid: errors.length === 0,
		issues,
		errors,
		warnings,
		resolvedPayments: paymentValidation.resolvedPayments,
		projectedAssetBalances: projection.projectedAssetBalances
	};
}

/** Validates a draft, treating calculation-critical omissions as warnings. */
export function validateDraftSession(input: SessionValidationInput): SessionValidationResult {
	return validateSession(input, 'warning');
}

/** Validates a session for stand-up, treating required omissions as errors. */
export function validateStandUpSession(input: SessionValidationInput): SessionValidationResult {
	return validateSession(input, 'error');
}
