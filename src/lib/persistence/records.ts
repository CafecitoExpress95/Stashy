import {
	accountIdFromString,
	accountRecordIdFromString,
	appSettingsIdFromString,
	auditEntryIdFromString,
	isValidAccountSortOrder,
	isoTimestampFromString,
	paymentRecordIdFromString,
	sessionIdFromString,
	sitDownDateFromString,
	moneyFromMinorUnits,
	normalizeAccountName,
	validateAccountName,
	validateAssetThresholdPolicy,
	validateAssetThresholds,
	type Account,
	type AppSettings,
	type AuditEntry,
	type DraftAccountRecord,
	type DraftPaymentRecord,
	type AccountRecord,
	type PaymentRecord,
	type AssetThresholdPolicy,
	type AssetThresholds,
	type IsoTimestamp,
	type Money,
	type PaymentMode,
	type Session
} from '$lib/domain';
import { ConfigurationRepositoryError } from './configuration-repository';

function corrupt(message: string): never {
	throw new ConfigurationRepositoryError('corrupt-data', message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readTimestamp(value: unknown, label: string): IsoTimestamp {
	if (typeof value !== 'string') {
		return corrupt(`${label} must be a stored UTC timestamp.`);
	}
	try {
		return isoTimestampFromString(value);
	} catch {
		return corrupt(`${label} is not a valid stored UTC timestamp.`);
	}
}

function readNullableTimestamp(value: unknown, label: string): IsoTimestamp | null {
	return value === null ? null : readTimestamp(value, label);
}

function readMoney(value: unknown, label: string): Money {
	if (typeof value !== 'number') {
		return corrupt(`${label} must be stored as integer cents.`);
	}
	try {
		return moneyFromMinorUnits(value);
	} catch {
		return corrupt(`${label} must be stored as safe integer cents.`);
	}
}

function readThresholds(value: unknown, label: string): AssetThresholds {
	if (!isRecord(value)) {
		return corrupt(`${label} must contain warning and danger values.`);
	}
	const thresholds = {
		warningBelow: readMoney(value.warningBelow, `${label} warning`),
		dangerBelow: readMoney(value.dangerBelow, `${label} danger`)
	};
	if (!validateAssetThresholds(thresholds).ok) {
		return corrupt(`${label} danger must be lower than warning.`);
	}
	return thresholds;
}

function readThresholdPolicy(value: unknown): AssetThresholdPolicy {
	if (!isRecord(value) || !['inherit', 'custom', 'off'].includes(String(value.mode))) {
		return corrupt('Asset threshold policy is not supported.');
	}
	const policy: AssetThresholdPolicy =
		value.mode === 'custom'
			? { mode: 'custom', thresholds: readThresholds(value.thresholds, 'Custom thresholds') }
			: value.mode === 'inherit'
				? { mode: 'inherit' }
				: { mode: 'off' };
	if (!validateAssetThresholdPolicy(policy)) {
		return corrupt('Asset threshold policy is invalid.');
	}
	return policy;
}

export function parseStoredAccount(value: unknown): Account {
	if (!isRecord(value)) {
		return corrupt('Stored account must be an object.');
	}

	let id;
	try {
		id = accountIdFromString(String(value.id));
	} catch {
		return corrupt('Stored account ID is invalid.');
	}
	if (value.type !== 'asset' && value.type !== 'liability') {
		return corrupt('Stored account type is not supported.');
	}
	if (
		typeof value.name !== 'string' ||
		normalizeAccountName(value.name) !== value.name ||
		!value.name
	) {
		return corrupt('Stored account name must be non-empty and normalized.');
	}
	if (typeof value.archived !== 'boolean') {
		return corrupt('Stored account archive state is invalid.');
	}
	if (typeof value.sortOrder !== 'number' || !isValidAccountSortOrder(value.sortOrder)) {
		return corrupt('Stored account order is invalid.');
	}

	const common = {
		id,
		name: value.name,
		archived: value.archived,
		sortOrder: value.sortOrder,
		createdAt: readTimestamp(value.createdAt, 'Account createdAt'),
		updatedAt: readTimestamp(value.updatedAt, 'Account updatedAt')
	};
	return value.type === 'asset'
		? { ...common, type: 'asset', thresholdPolicy: readThresholdPolicy(value.thresholdPolicy) }
		: { ...common, type: 'liability' };
}

export function parseStoredAppSettings(value: unknown): AppSettings {
	if (!isRecord(value)) {
		return corrupt('Stored app settings must be an object.');
	}
	let id;
	try {
		id = appSettingsIdFromString(String(value.id));
	} catch {
		return corrupt('Stored app settings ID is invalid.');
	}
	if (value.schemaVersion !== 1 || value.currency !== 'USD') {
		return corrupt('Stored app settings use an unsupported schema or currency.');
	}

	return {
		id,
		schemaVersion: 1,
		currency: 'USD',
		defaultAssetThresholds:
			value.defaultAssetThresholds === null
				? null
				: readThresholds(value.defaultAssetThresholds, 'Default thresholds'),
		lastImportedAt: readNullableTimestamp(value.lastImportedAt, 'lastImportedAt'),
		lastExportedAt: readNullableTimestamp(value.lastExportedAt, 'lastExportedAt'),
		createdAt: readTimestamp(value.createdAt, 'Settings createdAt'),
		updatedAt: readTimestamp(value.updatedAt, 'Settings updatedAt')
	};
}
export function parseStoredAccounts(values: readonly unknown[]): Account[] {
	const accounts = values.map(parseStoredAccount);
	const positions = new Set<string>();
	for (let index = 0; index < accounts.length; index += 1) {
		const account = accounts[index];
		if (!validateAccountName(account.name, accounts.slice(0, index)).ok) {
			return corrupt('Stored account names must be globally unique.');
		}
		const position = `${account.type}:${account.sortOrder}`;
		if (positions.has(position)) {
			return corrupt('Stored account order contains duplicate positions.');
		}
		positions.add(position);
	}
	return accounts;
}

function readOptionalMoney(value: unknown, label: string): Money | undefined {
	return value === undefined ? undefined : readMoney(value, label);
}

function readOptionalNullableMoney(value: unknown, label: string): Money | null | undefined {
	return value === undefined || value === null ? value : readMoney(value, label);
}

function readNullableString(value: unknown, label: string): string | null {
	if (value === null) return null;
	if (typeof value !== 'string') return corrupt(`${label} must be text or null.`);
	return value;
}

export function parseStoredSession(value: unknown): Session {
	if (!isRecord(value)) return corrupt('Stored session must be an object.');
	let id;
	try {
		id = sessionIdFromString(String(value.id));
	} catch {
		return corrupt('Stored session ID is invalid.');
	}
	let sitDownDate;
	try {
		sitDownDate = sitDownDateFromString(String(value.sitDownDate));
	} catch {
		return corrupt('Stored sit-down date is invalid.');
	}
	if (typeof value.isDraft !== 'boolean') {
		return corrupt('Stored session draft state is invalid.');
	}
	return {
		id,
		sitDownDate,
		isDraft: value.isDraft,
		createdAt: readTimestamp(value.createdAt, 'Session createdAt'),
		updatedAt: readTimestamp(value.updatedAt, 'Session updatedAt')
	};
}

export function parseStoredDraftAccountRecord(value: unknown): DraftAccountRecord {
	if (!isRecord(value)) return corrupt('Stored account record must be an object.');
	let id;
	let sessionId;
	let accountId;
	try {
		id = accountRecordIdFromString(String(value.id));
		sessionId = sessionIdFromString(String(value.sessionId));
		accountId = accountIdFromString(String(value.accountId));
	} catch {
		return corrupt('Stored account record IDs are invalid.');
	}
	return {
		id,
		sessionId,
		accountId,
		openingBalance: readOptionalMoney(value.openingBalance, 'Account opening balance'),
		finalBalance: readOptionalMoney(value.finalBalance, 'Account final balance'),
		openingStatementBalance: readOptionalNullableMoney(
			value.openingStatementBalance,
			'Account opening statement balance'
		),
		finalStatementBalance: readOptionalNullableMoney(
			value.finalStatementBalance,
			'Account final statement balance'
		),
		createdAt: readTimestamp(value.createdAt, 'Account record createdAt'),
		updatedAt: readTimestamp(value.updatedAt, 'Account record updatedAt')
	};
}

export function parseStoredDraftPaymentRecord(value: unknown): DraftPaymentRecord {
	if (!isRecord(value)) return corrupt('Stored payment record must be an object.');
	let id;
	let sessionId;
	let liabilityAccountId;
	let sourceAssetAccountId;
	try {
		id = paymentRecordIdFromString(String(value.id));
		sessionId = sessionIdFromString(String(value.sessionId));
		liabilityAccountId = accountIdFromString(String(value.liabilityAccountId));
		sourceAssetAccountId =
			value.sourceAssetAccountId === undefined
				? undefined
				: accountIdFromString(String(value.sourceAssetAccountId));
	} catch {
		return corrupt('Stored payment record IDs are invalid.');
	}
	const paymentMode = value.paymentMode as PaymentMode | undefined;
	if (
		paymentMode !== undefined &&
		!['full-balance', 'statement-balance', 'custom', 'no-payment'].includes(paymentMode)
	) {
		return corrupt('Stored payment mode is invalid.');
	}
	return {
		id,
		sessionId,
		liabilityAccountId,
		sourceAssetAccountId,
		paymentMode,
		customPaymentAmount: readOptionalMoney(value.customPaymentAmount, 'Custom payment amount'),
		startingAccountBalance: readOptionalMoney(
			value.startingAccountBalance,
			'Starting account balance'
		),
		startingStatementBalance: readOptionalMoney(
			value.startingStatementBalance,
			'Starting statement balance'
		),
		confirmationId: readNullableString(value.confirmationId, 'Confirmation ID'),
		notes: readNullableString(value.notes, 'Payment notes'),
		createdAt: readTimestamp(value.createdAt, 'Payment record createdAt'),
		updatedAt: readTimestamp(value.updatedAt, 'Payment record updatedAt')
	};
}
function readNullableMoney(value: unknown, label: string): Money | null {
	return value === null ? null : readMoney(value, label);
}

export function parseStoredAccountRecord(value: unknown): AccountRecord {
	const draft = parseStoredDraftAccountRecord(value);
	if (!isRecord(value)) return corrupt('Stored account record must be an object.');
	return {
		...draft,
		openingBalance: readMoney(value.openingBalance, 'Account opening balance'),
		finalBalance: readMoney(value.finalBalance, 'Account final balance'),
		openingStatementBalance: readNullableMoney(
			value.openingStatementBalance,
			'Account opening statement balance'
		),
		finalStatementBalance: readNullableMoney(
			value.finalStatementBalance,
			'Account final statement balance'
		)
	};
}

export function parseStoredPaymentRecord(value: unknown): PaymentRecord {
	if (!isRecord(value)) return corrupt('Stored payment record must be an object.');
	const draft = parseStoredDraftPaymentRecord({ ...value, startingStatementBalance: undefined });
	if (!draft.paymentMode) {
		return corrupt('Completed payment mode is required.');
	}
	if (draft.paymentMode !== 'no-payment' && !draft.sourceAssetAccountId) {
		return corrupt('Completed paid payment source is required.');
	}
	if (draft.paymentMode === 'no-payment' && draft.sourceAssetAccountId !== undefined) {
		return corrupt('Completed no-payment rows must not store a source asset.');
	}
	return {
		...draft,
		sourceAssetAccountId: draft.sourceAssetAccountId,
		paymentMode: draft.paymentMode,
		paymentAmount: readMoney(value.paymentAmount, 'Payment amount'),
		startingAccountBalance: readMoney(value.startingAccountBalance, 'Starting account balance'),
		startingStatementBalance: readNullableMoney(
			value.startingStatementBalance,
			'Starting statement balance'
		),
		remainingAccountBalance: readMoney(value.remainingAccountBalance, 'Remaining account balance'),
		remainingStatementBalance: readNullableMoney(
			value.remainingStatementBalance,
			'Remaining statement balance'
		)
	};
}

/** Strictly validates one stored before-and-after correction entry. */
export function parseStoredAuditEntry(value: unknown): AuditEntry {
	if (!isRecord(value)) return corrupt('Stored audit entry must be an object.');

	let id;
	try {
		id = auditEntryIdFromString(String(value.id));
	} catch {
		return corrupt('Stored audit entry ID is invalid.');
	}
	const common = {
		id,
		notes: readNullableString(value.notes, 'Audit notes'),
		createdAt: readTimestamp(value.createdAt, 'Audit createdAt'),
		updatedAt: readTimestamp(value.updatedAt, 'Audit updatedAt')
	};

	if (value.entityType === 'session') {
		const before = parseStoredSession(value.before);
		const after = parseStoredSession(value.after);
		let entityId;
		try {
			entityId = sessionIdFromString(String(value.entityId));
		} catch {
			return corrupt('Stored session audit entity ID is invalid.');
		}
		if (before.id !== entityId || after.id !== entityId) {
			return corrupt('Stored session audit snapshots do not match their entity ID.');
		}
		return { ...common, entityType: 'session', entityId, before, after };
	}

	if (value.entityType === 'account-record') {
		const before = parseStoredAccountRecord(value.before);
		const after = parseStoredAccountRecord(value.after);
		let entityId;
		try {
			entityId = accountRecordIdFromString(String(value.entityId));
		} catch {
			return corrupt('Stored account-record audit entity ID is invalid.');
		}
		if (before.id !== entityId || after.id !== entityId) {
			return corrupt('Stored account-record audit snapshots do not match their entity ID.');
		}
		return { ...common, entityType: 'account-record', entityId, before, after };
	}

	if (value.entityType === 'payment-record') {
		const before = parseStoredPaymentRecord(value.before);
		const after = parseStoredPaymentRecord(value.after);
		let entityId;
		try {
			entityId = paymentRecordIdFromString(String(value.entityId));
		} catch {
			return corrupt('Stored payment-record audit entity ID is invalid.');
		}
		if (before.id !== entityId || after.id !== entityId) {
			return corrupt('Stored payment-record audit snapshots do not match their entity ID.');
		}
		return { ...common, entityType: 'payment-record', entityId, before, after };
	}

	return corrupt('Stored audit entry entity type is invalid.');
}
