/** Pure account-configuration validation and selectors. */
import type { AccountId } from './identity';
import { validateAssetThresholds } from './thresholds';
import type { Account, AssetThresholdPolicy } from './types';

export type AccountType = Account['type'];
export type AccountMoveDirection = 'up' | 'down';

export type AccountNameIssue = {
	readonly code: 'account-name-required' | 'duplicate-account-name';
	readonly message: string;
	readonly field: 'name';
};

export type AccountNameValidationResult =
	| { readonly ok: true; readonly value: string }
	| { readonly ok: false; readonly issue: AccountNameIssue };

/** Removes accidental leading and trailing whitespace before display or storage. */
export function normalizeAccountName(name: string): string {
	return name.trim();
}

function comparableAccountName(name: string): string {
	return normalizeAccountName(name).toLocaleLowerCase('en-US');
}

/** Validates a name against every active and archived account. */
export function validateAccountName(
	name: string,
	accounts: readonly Account[],
	excludedAccountId?: AccountId
): AccountNameValidationResult {
	const normalizedName = normalizeAccountName(name);
	if (normalizedName.length === 0) {
		return {
			ok: false,
			issue: {
				code: 'account-name-required',
				message: 'Enter an account name.',
				field: 'name'
			}
		};
	}

	const comparableName = comparableAccountName(normalizedName);
	const duplicate = accounts.some(
		(account) =>
			account.id !== excludedAccountId && comparableAccountName(account.name) === comparableName
	);
	if (duplicate) {
		return {
			ok: false,
			issue: {
				code: 'duplicate-account-name',
				message: 'Account names must be unique, including archived accounts.',
				field: 'name'
			}
		};
	}

	return { ok: true, value: normalizedName };
}

/** Provides deterministic ordering when two records temporarily share a position. */
export function compareAccounts(left: Account, right: Account): number {
	return (
		left.sortOrder - right.sortOrder ||
		left.createdAt.localeCompare(right.createdAt) ||
		left.id.localeCompare(right.id)
	);
}

export function sortAccounts(accounts: readonly Account[]): Account[] {
	return [...accounts].sort(compareAccounts);
}

export function selectActiveAccounts(accounts: readonly Account[], type: AccountType): Account[] {
	return sortAccounts(accounts.filter((account) => account.type === type && !account.archived));
}

export function selectArchivedAccounts(accounts: readonly Account[]): Account[] {
	return [...accounts]
		.filter((account) => account.archived)
		.sort((left, right) => left.type.localeCompare(right.type) || compareAccounts(left, right));
}

export function getNextAccountSortOrder(accounts: readonly Account[], type: AccountType): number {
	const matchingOrders = accounts
		.filter((account) => account.type === type)
		.map((account) => account.sortOrder);
	return matchingOrders.length === 0 ? 0 : Math.max(...matchingOrders) + 1;
}

export function findAdjacentActiveAccount(
	accounts: readonly Account[],
	account: Account,
	direction: AccountMoveDirection
): Account | null {
	const activeAccounts = selectActiveAccounts(accounts, account.type);
	const accountIndex = activeAccounts.findIndex((candidate) => candidate.id === account.id);
	if (accountIndex < 0) {
		return null;
	}

	const adjacentIndex = direction === 'up' ? accountIndex - 1 : accountIndex + 1;
	return activeAccounts[adjacentIndex] ?? null;
}

export function isValidAccountSortOrder(sortOrder: number): boolean {
	return Number.isSafeInteger(sortOrder) && sortOrder >= 0;
}

/** Reuses the Phase 1 threshold-order contract for persisted custom policies. */
export function validateAssetThresholdPolicy(policy: AssetThresholdPolicy): boolean {
	return policy.mode !== 'custom' || validateAssetThresholds(policy.thresholds).ok;
}
