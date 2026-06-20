import { describe, expect, it } from 'vitest';
import { accountIdFromString } from './identity';
import { moneyFromMinorUnits } from './money';
import { canonicalAccounts, fixtureTimestamp } from './test-fixtures';
import type { Account } from './types';
import {
	findAdjacentActiveAccount,
	getNextAccountSortOrder,
	isValidAccountSortOrder,
	normalizeAccountName,
	selectActiveAccounts,
	selectArchivedAccounts,
	validateAccountName,
	validateAssetThresholdPolicy
} from './configuration';

const archivedCard: Account = {
	id: accountIdFromString('00000000-0000-4000-8000-000000000099'),
	type: 'liability',
	name: 'Old Card',
	archived: true,
	sortOrder: 3,
	createdAt: fixtureTimestamp,
	updatedAt: fixtureTimestamp
};

describe('account names', () => {
	it('trims names and rejects blank input', () => {
		expect(normalizeAccountName('  Checking  ')).toBe('Checking');
		expect(validateAccountName('   ', canonicalAccounts)).toEqual({
			ok: false,
			issue: expect.objectContaining({ code: 'account-name-required' })
		});
	});

	it('rejects case-insensitive duplicates across active and archived accounts', () => {
		expect(validateAccountName(' checking ', canonicalAccounts).ok).toBe(false);
		expect(validateAccountName('OLD CARD', [...canonicalAccounts, archivedCard]).ok).toBe(false);
	});

	it('allows an account to retain its own normalized name while editing', () => {
		expect(validateAccountName(' checking ', canonicalAccounts, canonicalAccounts[0].id)).toEqual({
			ok: true,
			value: 'checking'
		});
	});
});

describe('account selection and ordering', () => {
	it('selects active accounts by type in deliberate order', () => {
		const reordered = canonicalAccounts.map((account) =>
			account.id === canonicalAccounts[0].id ? { ...account, sortOrder: 5 } : account
		);
		expect(selectActiveAccounts(reordered, 'asset').map((account) => account.name)).toEqual([
			'Savings',
			'Checking'
		]);
	});

	it('keeps archived accounts resolvable without returning them as active', () => {
		const accounts = [...canonicalAccounts, archivedCard];
		expect(selectActiveAccounts(accounts, 'liability')).not.toContainEqual(archivedCard);
		expect(selectArchivedAccounts(accounts)).toEqual([archivedCard]);
	});

	it('finds adjacent active accounts and appends after archived positions', () => {
		const accounts = [...canonicalAccounts, archivedCard];
		expect(findAdjacentActiveAccount(accounts, canonicalAccounts[3], 'up')?.name).toBe('Card A');
		expect(findAdjacentActiveAccount(accounts, canonicalAccounts[3], 'down')?.name).toBe('Card C');
		expect(getNextAccountSortOrder(accounts, 'liability')).toBe(4);
	});
});

describe('configuration invariants', () => {
	it('accepts non-negative safe integer sort positions only', () => {
		expect(isValidAccountSortOrder(0)).toBe(true);
		expect(isValidAccountSortOrder(-1)).toBe(false);
		expect(isValidAccountSortOrder(1.5)).toBe(false);
	});

	it('validates only custom threshold policies', () => {
		expect(validateAssetThresholdPolicy({ mode: 'inherit' })).toBe(true);
		expect(validateAssetThresholdPolicy({ mode: 'off' })).toBe(true);
		expect(
			validateAssetThresholdPolicy({
				mode: 'custom',
				thresholds: {
					warningBelow: moneyFromMinorUnits(10_000),
					dangerBelow: moneyFromMinorUnits(10_000)
				}
			})
		).toBe(false);
	});
});
