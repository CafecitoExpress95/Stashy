/** Asset threshold validation, policy resolution, and color-state classification. */
import { createIssue, type DomainResult } from './issues';
import type { Money } from './money';
import type { AssetThresholdPolicy, AssetThresholds } from './types';

/** The passive visual state shown for an asset balance. */
export type AssetThresholdState = 'none' | 'healthy' | 'warning' | 'danger';

/** Ensures the danger boundary is strictly lower than the warning boundary. */
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

/** Resolves inherit, custom, and off policies to effective thresholds. */
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

/**
 * Classifies a balance using strict "below" checks. Equality at warning is
 * healthy; equality at danger remains warning. Each lower state starts one cent below.
 */
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
