export type DomainIssueSeverity = 'warning' | 'error';

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
	| 'negative-remaining-statement-balance'
	| 'negative-projected-asset-balance'
	| 'zero-projected-asset-balance'
	| 'invalid-threshold-order';

export interface DomainIssue {
	readonly severity: DomainIssueSeverity;
	readonly code: DomainIssueCode;
	readonly message: string;
	readonly entityId?: string;
	readonly field?: string;
}

export type DomainResult<Value> =
	| { readonly ok: true; readonly value: Value }
	| { readonly ok: false; readonly errors: readonly DomainIssue[] };

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
