import { describe, expect, it } from 'vitest';
import { auditEntryIdFromString } from './identity';
import { canonicalAccounts, canonicalSession, fixtureTimestamp } from './test-fixtures';
import type { Account, AuditEntry, SessionAuditEntry } from './types';

function describeAccountKind(account: Account): string {
	if (account.type === 'asset') {
		// The discriminator narrows this branch to AssetAccount.
		return `asset:${account.thresholdPolicy.mode}`;
	}

	return 'liability';
}

function getEditedSnapshotId(entry: AuditEntry): string {
	switch (entry.entityType) {
		case 'session':
			return entry.after.id;
		case 'account-record':
			return entry.after.id;
		case 'payment-record':
			return entry.after.id;
	}
}

describe('composed domain record shapes', () => {
	it('keeps account metadata flat at runtime', () => {
		const asset = canonicalAccounts[0];

		expect(Object.keys(asset).sort()).toEqual(
			[
				'archived',
				'createdAt',
				'id',
				'name',
				'sortOrder',
				'thresholdPolicy',
				'type',
				'updatedAt'
			].sort()
		);
		expect(asset).not.toHaveProperty('timestamps');
		expect(asset).not.toHaveProperty('details');
	});

	it('keeps session timestamps and fields in one flat record', () => {
		expect(Object.keys(canonicalSession).sort()).toEqual(
			['createdAt', 'id', 'isDraft', 'sitDownDate', 'updatedAt'].sort()
		);
		expect(canonicalSession).not.toHaveProperty('timestamps');
	});
});

describe('discriminated unions', () => {
	it('narrows asset and liability accounts by their type field', () => {
		expect(describeAccountKind(canonicalAccounts[0])).toBe('asset:custom');
		expect(describeAccountKind(canonicalAccounts[2])).toBe('liability');
	});

	it('narrows audit snapshots by their entity type', () => {
		const auditEntry: SessionAuditEntry = {
			id: auditEntryIdFromString('50000000-0000-4000-8000-000000000001'),
			entityType: 'session',
			entityId: canonicalSession.id,
			before: canonicalSession,
			after: { ...canonicalSession, isDraft: true },
			notes: null,
			createdAt: fixtureTimestamp,
			updatedAt: fixtureTimestamp
		};

		expect(getEditedSnapshotId(auditEntry)).toBe(canonicalSession.id);
	});
});
