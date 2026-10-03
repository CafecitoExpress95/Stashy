import type { SitDownSnapshot } from './sit-down-repository';

/** Returns storage-level ownership and uniqueness problems for one normalized session. */
export function getSessionRelationshipIssues(
	snapshot: SitDownSnapshot,
	expectedDraft: boolean
): readonly string[] {
	const issues: string[] = [];
	if (snapshot.session.isDraft !== expectedDraft) {
		issues.push(
			expectedDraft
				? 'A draft save requires an unfinished sit-down.'
				: 'Standing up requires a completed sit-down snapshot.'
		);
	}

	const accountIds = new Set<string>();
	for (const record of snapshot.accountRecords) {
		if (record.sessionId !== snapshot.session.id) {
			issues.push('Every account snapshot must belong to the sit-down session.');
		}
		if (accountIds.has(record.accountId)) {
			issues.push('A sit-down cannot contain duplicate account snapshots.');
		}
		accountIds.add(record.accountId);
	}

	const liabilityIds = new Set<string>();
	for (const payment of snapshot.paymentRecords) {
		if (payment.sessionId !== snapshot.session.id) {
			issues.push('Every payment must belong to the sit-down session.');
		}
		if (!accountIds.has(payment.liabilityAccountId)) {
			issues.push('Every payment liability must have an account snapshot.');
		}
		if (
			payment.sourceAssetAccountId !== undefined &&
			!accountIds.has(payment.sourceAssetAccountId)
		) {
			issues.push('Every selected source asset must have an account snapshot.');
		}
		if (liabilityIds.has(payment.liabilityAccountId)) {
			issues.push('A sit-down cannot contain duplicate liability payments.');
		}
		liabilityIds.add(payment.liabilityAccountId);
	}

	return [...new Set(issues)];
}
