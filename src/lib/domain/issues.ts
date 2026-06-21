/** Stable validation and calculation issue contracts shared by domain APIs. */
export type DomainIssueSeverity = 'warning' | 'error';

/** Machine-readable codes that future UI can group without parsing message text. */
export type DomainIssueCode =
	| 'missing-source-asset'
	| 'missing-payment-mode'
	| 'missing-custom-payment-amount'
	| 'missing-starting-account-balance'
	| 'missing-starting-statement-balance'
	| 'missing-opening-balance'
	| 'missing-final-balance'
	| 'missing-source-asset-balance'
	| 'invalid-liability-account'
	| 'invalid-source-asset'
	| 'invalid-account-reference'
	| 'session-reference-mismatch'
	| 'duplicate-liability-payment'
	| 'negative-payment'
	| 'payment-exceeds-account-balance'
	| 'negative-remaining-account-balance'
	| 'negative-projected-asset-balance'
	| 'zero-projected-asset-balance'
	| 'invalid-threshold-order';

/** One calm user-facing issue with optional record and field context. */
export type DomainIssue = {
	readonly severity: DomainIssueSeverity;
	readonly code: DomainIssueCode;
	readonly message: string;
	readonly entityId?: string;
	readonly field?: string;
};

/** A success value or one or more hard domain errors. */
export type DomainResult<Value> =
	| { readonly ok: true; readonly value: Value }
	| { readonly ok: false; readonly errors: readonly DomainIssue[] };

/** Internal constructor that keeps issue object creation consistent across modules. */
export function createIssue(
	severity: DomainIssueSeverity,
	code: DomainIssueCode,
	message: string,
	context: Pick<DomainIssue, 'entityId' | 'field'> = {}
): DomainIssue {
	return {
		severity,
		code,
		message,
		...context
	};
}
