/** Draft and stand-up validation for a complete sit-down. */
import {
	calculatePayment,
	calculateProjectedAssetBalances,
	type AssetOpeningBalance,
	type ProjectedAssetBalance
} from './calculations';
import type { AccountId, PaymentRecordId, SessionId } from './identity';
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
	readonly assetProjections: readonly AssetProjectionAssessment[];
	readonly paymentExclusions: readonly PaymentProjectionExclusion[];
};

/** Projection inputs deliberately omit date validity and persistence readiness. */
export type DraftProjectionInput = Omit<SessionValidationInput, 'session'> & {
	readonly sessionId: SessionId;
};

/** Whether the available result includes every paid row attributable to this asset. */
export type ProjectionCompleteness = 'complete' | 'partial' | 'unavailable';

/** An excluded row retains its identity, attribution, and existing issue codes. */
export type PaymentProjectionExclusion = {
	readonly paymentId: PaymentRecordId;
	readonly sourceAssetAccountId?: AccountId;
	readonly issues: readonly DomainIssue[];
};

/** Completeness and reasons belonging to one normalized source snapshot. */
export type AssetProjectionAssessment = {
	readonly accountId: AccountId;
	readonly completeness: ProjectionCompleteness;
	readonly issues: readonly DomainIssue[];
};

/** Exact available results and explicit omissions, independent of saving. */
export type DraftProjectionAssessment = Pick<
	SessionValidationResult,
	| 'issues'
	| 'resolvedPayments'
	| 'projectedAssetBalances'
	| 'assetProjections'
	| 'paymentExclusions'
>;

type ValidationLookups = {
	readonly accountsById: ReadonlyMap<AccountId, Account>;
	readonly accountRecordsByAccountId: ReadonlyMap<AccountId, DraftAccountRecord>;
};

const CALCULATION_FIELD_ISSUE_CODES = new Set<DomainIssueCode>([
	'missing-source-asset',
	'missing-payment-mode',
	'missing-custom-payment-amount',
	'missing-starting-account-balance',
	'missing-starting-statement-balance'
]);

function createValidationLookups(input: DraftProjectionInput): ValidationLookups {
	return {
		accountsById: new Map(input.accounts.map((account) => [account.id, account])),
		accountRecordsByAccountId: new Map(
			input.accountRecords.map((record) => [record.accountId, record])
		)
	};
}

function validateAccountRecords(
	input: DraftProjectionInput,
	lookups: ValidationLookups,
	missingFieldSeverity: DomainIssueSeverity
): DomainIssue[] {
	const issues: DomainIssue[] = [];

	for (const record of input.accountRecords) {
		if (record.sessionId !== input.sessionId) {
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
	input: DraftProjectionInput,
	lookups: ValidationLookups,
	missingFieldSeverity: DomainIssueSeverity
): { readonly issues: DomainIssue[]; readonly sourceOpeningIsAvailable: boolean } {
	const issues: DomainIssue[] = [];
	let sourceOpeningIsAvailable = true;

	if (record.sessionId !== input.sessionId) {
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

function getAssetOpeningBalances(
	input: DraftProjectionInput,
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

	return warnings;
}

/**
 * Checks structure before excluding unfinished rows, then reuses strict exact projection.
 * A source without an opening affects only itself; unknown attribution affects every source.
 */
export function assessDraftProjection(input: DraftProjectionInput): DraftProjectionAssessment {
	const lookups = createValidationLookups(input);
	const duplicatePaymentIds = findDuplicatePaymentIds(input.paymentRecords);
	const issues = [
		...validateAccountRecords(input, lookups, 'warning'),
		...getDuplicatePaymentIssues(duplicatePaymentIds)
	];
	const resolvedPayments: PaymentRecord[] = [];
	const paymentExclusions: PaymentProjectionExclusion[] = [];
	for (const record of input.paymentRecords) {
		const reference = validatePaymentReference(record, input, lookups, 'warning');
		const calculation = calculatePayment(record);
		const rowIssues = [
			...reference.issues,
			...(calculation.ok
				? []
				: calculation.errors.map((issue) => applyMissingFieldSeverity(issue, 'warning')))
		];
		issues.push(...rowIssues);
		if (calculation.ok) {
			resolvedPayments.push(calculation.value);
			issues.push(...getPaymentWarnings(calculation.value));
		}
		if (
			record.paymentMode !== 'no-payment' &&
			(!calculation.ok ||
				!reference.sourceOpeningIsAvailable ||
				rowIssues.some((issue) => issue.severity === 'error'))
		) {
			paymentExclusions.push({
				paymentId: record.id,
				sourceAssetAccountId: record.sourceAssetAccountId,
				issues: rowIssues
			});
		}
	}

	// Never hide structural failures by filtering their rows out of the calculation.
	const structuralIssues = issues.filter((issue) => issue.severity === 'error');
	let projectedAssetBalances: readonly ProjectedAssetBalance[] | null = null;
	if (structuralIssues.length === 0) {
		const excludedIds = new Set(paymentExclusions.map((row) => row.paymentId));
		const projection = calculateProjectedAssetBalances(
			getAssetOpeningBalances(input, lookups),
			resolvedPayments.filter((row) => !excludedIds.has(row.id))
		);
		if (projection.ok) {
			projectedAssetBalances = projection.value;
			issues.push(...getProjectedAssetWarnings(projection.value));
		} else {
			issues.push(...projection.errors);
			structuralIssues.push(...projection.errors);
		}
	}
	const assetProjections: AssetProjectionAssessment[] = input.accountRecords
		.filter((record) => lookups.accountsById.get(record.accountId)?.type === 'asset')
		.map((record) => {
			const exclusions = paymentExclusions.filter(
				(row) => !row.sourceAssetAccountId || row.sourceAssetAccountId === record.accountId
			);
			return {
				accountId: record.accountId,
				completeness:
					projectedAssetBalances === null || record.openingBalance === undefined
						? 'unavailable'
						: exclusions.length > 0
							? 'partial'
							: 'complete',
				issues: [
					...structuralIssues,
					...issues.filter(
						(issue) => issue.entityId === record.id || issue.entityId === record.accountId
					),
					...exclusions.flatMap((row) => row.issues)
				]
			};
		});
	return { issues, resolvedPayments, projectedAssetBalances, assetProjections, paymentExclusions };
}

function validateSession(
	input: SessionValidationInput,
	missingFieldSeverity: DomainIssueSeverity
): SessionValidationResult {
	const assessment = assessDraftProjection({ ...input, sessionId: input.session.id });
	const issues = assessment.issues.map((issue) =>
		usesCalculationField(issue) ||
		['missing-opening-balance', 'missing-final-balance', 'missing-source-asset-balance'].includes(
			issue.code
		)
			? { ...issue, severity: missingFieldSeverity }
			: issue
	);
	const errors = issues.filter((issue) => issue.severity === 'error');
	const warnings = issues.filter((issue) => issue.severity === 'warning');

	return {
		...assessment,
		isValid: errors.length === 0,
		issues,
		errors,
		warnings,
		projectedAssetBalances:
			missingFieldSeverity === 'error' &&
			(assessment.resolvedPayments.length !== input.paymentRecords.length ||
				assessment.paymentExclusions.length > 0)
				? null
				: assessment.projectedAssetBalances
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
