import { createIssue, type DomainResult } from './issues';
import type { Money } from './money';
import type { AssetThresholdPolicy, AssetThresholds } from './types';

export type AssetThresholdState = 'none' | 'healthy' | 'warning' | 'danger';

export function validateAssetThresholds(
	thresholds: AssetThresholds
): DomainResult<AssetThresholds> {
	if (thresholds.dangerBelow >= thresholds.warningBelow) {
		return {
			ok: false,
			errors: [
				createIssue(
					'error',
					'invalid-threshold-order',
					'Danger must be lower than warning so the threshold colors have a clear order.',
					{ field: 'dangerBelow' }
				)
			]
		};
	}

	return { ok: true, value: thresholds };
}

export function resolveAssetThresholds(
	defaults: AssetThresholds | null,
	policy: AssetThresholdPolicy
): DomainResult<AssetThresholds | null> {
	if (policy.mode === 'off') {
		return { ok: true, value: null };
	}

	const thresholds = policy.mode === 'custom' ? policy.thresholds : defaults;
	if (!thresholds) {
		return { ok: true, value: null };
	}

	return validateAssetThresholds(thresholds);
}

export function getAssetThresholdState(
	balance: Money,
	thresholds: AssetThresholds | null
): AssetThresholdState {
	if (!thresholds) {
		return 'none';
	}

	if (balance < thresholds.dangerBelow) {
		return 'danger';
	}

	if (balance < thresholds.warningBelow) {
		return 'warning';
	}

	return 'healthy';
}
