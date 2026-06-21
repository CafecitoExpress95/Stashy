/** Pure form-state adaptation for the Phase 3 sit-down cockpit. */
import { calculatePayment } from './calculations';
import { selectActiveAccounts, sortAccounts } from './configuration';
import type {
	AccountId,
	AccountRecordId,
	IsoTimestamp,
	PaymentRecordId,
	SessionId
} from './identity';
import { sitDownDateFromString } from './identity';
import type { DomainIssue } from './issues';
import { formatMoney, parseMoneyInput, ZERO_MONEY, type Money } from './money';
import {
	getAssetThresholdState,
	resolveAssetThresholds,
	type AssetThresholdState
} from './thresholds';
import type {
	Account,
	AppSettings,
	DraftAccountRecord,
	DraftPaymentRecord,
	PaymentMode,
	PaymentRecord,
	Session
} from './types';
import {
	validateDraftSession,
	validateStandUpSession,
	type SessionValidationResult
} from './validation';

export type CockpitAssetForm = {
	readonly accountId: AccountId;
	readonly recordId: AccountRecordId;
	openingBalanceText: string;
};

export type CockpitPaymentForm = {
	readonly recordId: AccountRecordId;
	readonly paymentId: PaymentRecordId;
	readonly liabilityAccountId: AccountId;
	sourceAssetAccountId: AccountId | '';
	paymentMode: PaymentMode | '';
	startingAccountBalanceText: string;
	startingStatementBalanceText: string;
	customPaymentAmountText: string;
	confirmationId: string;
	notes: string;
};

/** Mutable, text-preserving state owned by the route while the user types. */
export type CockpitForm = {
	readonly sessionId: SessionId;
	readonly createdAt: IsoTimestamp;
	updatedAt: IsoTimestamp;
	sitDownDateText: string;
	assets: CockpitAssetForm[];
	payments: CockpitPaymentForm[];
};

export type CockpitIdFactory = {
	readonly accountRecordId: () => AccountRecordId;
	readonly paymentRecordId: () => PaymentRecordId;
	readonly sessionId: () => SessionId;
};

export type CockpitFieldError = {
	readonly controlId: string;
	readonly message: string;
};

export type CockpitAssetView = {
	readonly accountId: AccountId;
	readonly openingBalance: Money | null;
	readonly projectedFinalBalance: Money | null;
	readonly projectedDisplay: string;
	readonly thresholdState: AssetThresholdState;
	readonly safetyState: 'normal' | 'zero' | 'negative';
	readonly issues: readonly DomainIssue[];
};

export type CockpitPaymentView = {
	readonly paymentId: PaymentRecordId;
	readonly resolvedPayment: PaymentRecord | null;
	readonly paymentAmountDisplay: string;
	readonly remainingAccountBalanceDisplay: string;
	readonly remainingStatementBalanceDisplay: string;
	readonly issues: readonly DomainIssue[];
};

export type CockpitDerivation = {
	readonly session: Session | null;
	readonly accountRecords: readonly DraftAccountRecord[];
	readonly paymentRecords: readonly DraftPaymentRecord[];
	readonly draftValidation: SessionValidationResult | null;
	readonly standUpValidation: SessionValidationResult | null;
	readonly assets: readonly CockpitAssetView[];
	readonly payments: readonly CockpitPaymentView[];
	readonly fieldErrors: readonly CockpitFieldError[];
	readonly firstDraftBlockingControlId: string | null;
	readonly firstStandUpBlockingControlId: string | null;
	readonly canSaveDraft: boolean;
};

export type CockpitDraftData = {
	readonly session: Session;
	readonly accountRecords: readonly DraftAccountRecord[];
	readonly paymentRecords: readonly DraftPaymentRecord[];
};

type ParsedMoney = {
	readonly value?: Money;
	readonly error?: CockpitFieldError;
};

function assetOpeningControlId(accountId: AccountId): string {
	return `asset-${accountId}-openingBalance`;
}

function paymentControlId(paymentId: PaymentRecordId, field: string): string {
	return `payment-${paymentId}-${field}`;
}

function parseOptionalMoney(text: string, controlId: string): ParsedMoney {
	if (text.trim().length === 0) return {};
	const result = parseMoneyInput(text);
	return result.ok ? { value: result.value } : { error: { controlId, message: result.message } };
}

function nullableText(value: string): string | null {
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

function issueMatches(issue: DomainIssue, entityId: string): boolean {
	return issue.entityId === entityId;
}

/** Creates a fresh cockpit using only currently active accounts in configured order. */
export function createCockpitForm(
	accounts: readonly Account[],
	date: string,
	timestamp: IsoTimestamp,
	ids: CockpitIdFactory
): CockpitForm {
	return {
		sessionId: ids.sessionId(),
		createdAt: timestamp,
		updatedAt: timestamp,
		sitDownDateText: date,
		assets: selectActiveAccounts(accounts, 'asset').map((account) => ({
			accountId: account.id,
			recordId: ids.accountRecordId(),
			openingBalanceText: ''
		})),
		payments: selectActiveAccounts(accounts, 'liability').map((account) => ({
			recordId: ids.accountRecordId(),
			paymentId: ids.paymentRecordId(),
			liabilityAccountId: account.id,
			sourceAssetAccountId: '',
			paymentMode: '',
			startingAccountBalanceText: '',
			startingStatementBalanceText: '',
			customPaymentAmountText: '',
			confirmationId: '',
			notes: ''
		}))
	};
}

/** Reconstructs editable text from a normalized saved draft without changing IDs. */
export function hydrateCockpitForm(
	draft: CockpitDraftData,
	accounts: readonly Account[]
): CockpitForm {
	const accountsById = new Map(accounts.map((account) => [account.id, account]));
	const recordsByAccountId = new Map(
		draft.accountRecords.map((record) => [record.accountId, record])
	);
	const paymentsByLiabilityId = new Map(
		draft.paymentRecords.map((record) => [record.liabilityAccountId, record])
	);
	const draftAccountIds = new Set(draft.accountRecords.map((record) => record.accountId));
	const orderedAccounts = sortAccounts(
		accounts.filter((account) => draftAccountIds.has(account.id))
	);

	for (const accountId of draftAccountIds) {
		if (!accountsById.has(accountId)) {
			throw new Error('A saved draft refers to an account that no longer exists.');
		}
	}

	return {
		sessionId: draft.session.id,
		createdAt: draft.session.createdAt,
		updatedAt: draft.session.updatedAt,
		sitDownDateText: draft.session.sitDownDate,
		assets: orderedAccounts
			.filter((account) => account.type === 'asset')
			.map((account) => {
				const record = recordsByAccountId.get(account.id);
				if (!record) throw new Error('Saved asset draft record is missing.');
				return {
					accountId: account.id,
					recordId: record.id,
					openingBalanceText:
						record.openingBalance === undefined ? '' : formatMoney(record.openingBalance)
				};
			}),
		payments: orderedAccounts
			.filter((account) => account.type === 'liability')
			.map((account) => {
				const record = recordsByAccountId.get(account.id);
				const payment = paymentsByLiabilityId.get(account.id);
				if (!record || !payment) throw new Error('Saved liability draft record is missing.');
				return {
					recordId: record.id,
					paymentId: payment.id,
					liabilityAccountId: account.id,
					sourceAssetAccountId: payment.sourceAssetAccountId ?? '',
					paymentMode: payment.paymentMode ?? '',
					startingAccountBalanceText:
						payment.startingAccountBalance === undefined
							? ''
							: formatMoney(payment.startingAccountBalance),
					startingStatementBalanceText:
						payment.startingStatementBalance === undefined
							? ''
							: formatMoney(payment.startingStatementBalance),
					customPaymentAmountText:
						payment.customPaymentAmount === undefined
							? ''
							: formatMoney(payment.customPaymentAmount),
					confirmationId: payment.confirmationId ?? '',
					notes: payment.notes ?? ''
				};
			})
	};
}

/** Converts raw text to normalized records and delegates money rules to Phase 1 APIs. */
export function deriveCockpit(
	form: CockpitForm,
	accounts: readonly Account[],
	settings: AppSettings
): CockpitDerivation {
	const fieldErrors: CockpitFieldError[] = [];
	let session: Session | null = null;
	try {
		session = {
			id: form.sessionId,
			sitDownDate: sitDownDateFromString(form.sitDownDateText),
			isDraft: true,
			createdAt: form.createdAt,
			updatedAt: form.updatedAt
		};
	} catch (error) {
		fieldErrors.push({
			controlId: 'sit-down-date',
			message: error instanceof Error ? error.message : 'Enter a valid sit-down date.'
		});
	}

	const assetOpenings = new Map<AccountId, Money>();
	const assetRecords: DraftAccountRecord[] = form.assets.map((asset) => {
		const parsed = parseOptionalMoney(
			asset.openingBalanceText,
			assetOpeningControlId(asset.accountId)
		);
		if (parsed.error) fieldErrors.push(parsed.error);
		if (parsed.value !== undefined) assetOpenings.set(asset.accountId, parsed.value);
		return {
			id: asset.recordId,
			sessionId: form.sessionId,
			accountId: asset.accountId,
			openingBalance: parsed.value,
			finalBalance: parsed.value,
			openingStatementBalance: null,
			finalStatementBalance: null,
			createdAt: form.createdAt,
			updatedAt: form.updatedAt
		};
	});

	const paymentRecords: DraftPaymentRecord[] = [];
	const liabilityRecordInputs: Array<{
		readonly form: CockpitPaymentForm;
		readonly accountBalance?: Money;
		readonly statementBalance?: Money;
	}> = [];

	for (const payment of form.payments) {
		const accountBalance = parseOptionalMoney(
			payment.startingAccountBalanceText,
			paymentControlId(payment.paymentId, 'startingAccountBalance')
		);
		const statementBalance = parseOptionalMoney(
			payment.startingStatementBalanceText,
			paymentControlId(payment.paymentId, 'startingStatementBalance')
		);
		const customAmount =
			payment.paymentMode === 'custom'
				? parseOptionalMoney(
						payment.customPaymentAmountText,
						paymentControlId(payment.paymentId, 'customPaymentAmount')
					)
				: {};
		for (const parsed of [accountBalance, statementBalance, customAmount]) {
			if (parsed.error) fieldErrors.push(parsed.error);
		}

		paymentRecords.push({
			id: payment.paymentId,
			sessionId: form.sessionId,
			liabilityAccountId: payment.liabilityAccountId,
			sourceAssetAccountId: payment.sourceAssetAccountId || undefined,
			paymentMode: payment.paymentMode || undefined,
			customPaymentAmount: customAmount.value,
			startingAccountBalance: accountBalance.value,
			startingStatementBalance: statementBalance.value,
			confirmationId: nullableText(payment.confirmationId),
			notes: nullableText(payment.notes),
			createdAt: form.createdAt,
			updatedAt: form.updatedAt
		});
		liabilityRecordInputs.push({
			form: payment,
			accountBalance: accountBalance.value,
			statementBalance: statementBalance.value
		});
	}

	const resolvedPayments = new Map<PaymentRecordId, PaymentRecord>();
	for (const payment of paymentRecords) {
		const result = calculatePayment(payment);
		if (result.ok) resolvedPayments.set(payment.id, result.value);
	}

	const liabilityRecords: DraftAccountRecord[] = liabilityRecordInputs.map((input) => {
		const resolved = resolvedPayments.get(input.form.paymentId);
		return {
			id: input.form.recordId,
			sessionId: form.sessionId,
			accountId: input.form.liabilityAccountId,
			openingBalance: input.accountBalance,
			finalBalance: resolved?.remainingAccountBalance,
			openingStatementBalance: input.statementBalance,
			finalStatementBalance: resolved?.remainingStatementBalance,
			createdAt: form.createdAt,
			updatedAt: form.updatedAt
		};
	});

	const initialAccountRecords = [...assetRecords, ...liabilityRecords];
	const input = session
		? { session, accounts, accountRecords: initialAccountRecords, paymentRecords }
		: null;
	const draftValidation = input ? validateDraftSession(input) : null;
	const standUpValidation = input ? validateStandUpSession(input) : null;
	const projectedByAssetId = new Map(
		draftValidation?.projectedAssetBalances?.map((asset) => [
			asset.accountId,
			asset.projectedFinalBalance
		]) ?? []
	);
	const accountRecords = initialAccountRecords.map((record) => {
		const account = accounts.find((candidate) => candidate.id === record.accountId);
		if (account?.type !== 'asset') return record;
		return {
			...record,
			finalBalance: projectedByAssetId.get(record.accountId) ?? record.openingBalance
		};
	});

	const assetViews: CockpitAssetView[] = form.assets.map((asset) => {
		const account = accounts.find((candidate) => candidate.id === asset.accountId);
		const openingBalance = assetOpenings.get(asset.accountId) ?? null;
		const projectedFinalBalance = projectedByAssetId.get(asset.accountId) ?? openingBalance;
		let thresholdState: AssetThresholdState = 'none';
		if (account?.type === 'asset' && projectedFinalBalance !== null) {
			const thresholds = resolveAssetThresholds(
				settings.defaultAssetThresholds,
				account.thresholdPolicy
			);
			if (thresholds.ok) {
				thresholdState = getAssetThresholdState(projectedFinalBalance, thresholds.value);
			}
		}
		return {
			accountId: asset.accountId,
			openingBalance,
			projectedFinalBalance,
			projectedDisplay: projectedFinalBalance === null ? '—' : formatMoney(projectedFinalBalance),
			thresholdState,
			safetyState:
				projectedFinalBalance === null || projectedFinalBalance > ZERO_MONEY
					? 'normal'
					: projectedFinalBalance === ZERO_MONEY
						? 'zero'
						: 'negative',
			issues:
				draftValidation?.warnings.filter((issue) => issueMatches(issue, asset.accountId)) ?? []
		};
	});

	const paymentViews: CockpitPaymentView[] = form.payments.map((payment) => {
		const resolvedPayment = resolvedPayments.get(payment.paymentId) ?? null;
		return {
			paymentId: payment.paymentId,
			resolvedPayment,
			paymentAmountDisplay: resolvedPayment ? formatMoney(resolvedPayment.paymentAmount) : '—',
			remainingAccountBalanceDisplay: resolvedPayment
				? formatMoney(resolvedPayment.remainingAccountBalance)
				: '—',
			remainingStatementBalanceDisplay: resolvedPayment
				? formatMoney(resolvedPayment.remainingStatementBalance)
				: '—',
			issues:
				draftValidation?.warnings.filter((issue) => issueMatches(issue, payment.paymentId)) ?? []
		};
	});

	const standUpControls: string[] = [];
	if (!session) standUpControls.push('sit-down-date');
	for (const asset of form.assets) {
		const controlId = assetOpeningControlId(asset.accountId);
		if (
			fieldErrors.some((error) => error.controlId === controlId) ||
			!assetOpenings.has(asset.accountId)
		) {
			standUpControls.push(controlId);
		}
	}
	for (const payment of form.payments) {
		if (!payment.sourceAssetAccountId) {
			standUpControls.push(paymentControlId(payment.paymentId, 'sourceAssetAccountId'));
		}
		if (!payment.startingAccountBalanceText.trim()) {
			standUpControls.push(paymentControlId(payment.paymentId, 'startingAccountBalance'));
		}
		if (!payment.startingStatementBalanceText.trim()) {
			standUpControls.push(paymentControlId(payment.paymentId, 'startingStatementBalance'));
		}
		if (!payment.paymentMode) {
			standUpControls.push(paymentControlId(payment.paymentId, 'paymentMode'));
		}
		if (payment.paymentMode === 'custom' && !payment.customPaymentAmountText.trim()) {
			standUpControls.push(paymentControlId(payment.paymentId, 'customPaymentAmount'));
		}
	}

	return {
		session,
		accountRecords,
		paymentRecords,
		draftValidation,
		standUpValidation,
		assets: assetViews,
		payments: paymentViews,
		fieldErrors,
		firstDraftBlockingControlId: fieldErrors[0]?.controlId ?? null,
		firstStandUpBlockingControlId: fieldErrors[0]?.controlId ?? standUpControls[0] ?? null,
		canSaveDraft: session !== null && fieldErrors.length === 0
	};
}

/** Returns normalized data only when text-level draft requirements are satisfied. */
export function getCockpitDraftData(derivation: CockpitDerivation): CockpitDraftData | null {
	if (!derivation.canSaveDraft || !derivation.session || !derivation.draftValidation) {
		return null;
	}
	return {
		session: derivation.session,
		accountRecords: derivation.accountRecords,
		paymentRecords: derivation.paymentRecords
	};
}
