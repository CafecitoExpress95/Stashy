import {
	accountIdFromString,
	appSettingsIdFromString,
	isValidAccountSortOrder,
	isoTimestampFromString,
	moneyFromMinorUnits,
	normalizeAccountName,
	validateAccountName,
	validateAssetThresholdPolicy,
	validateAssetThresholds,
	type Account,
	type AppSettings,
	type AssetThresholdPolicy,
	type AssetThresholds,
	type IsoTimestamp,
	type Money
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
