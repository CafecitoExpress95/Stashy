import { describe, expect, it } from 'vitest';
import * as libApi from '../index';
import * as domainApi from './index';

const expectedRuntimeExports = [
	'IdentityFormatError',
	'MoneyInvariantError',
	'ZERO_MONEY',
	'accountIdFromString',
	'accountRecordIdFromString',
	'addMoney',
	'appSettingsIdFromString',
	'auditEntryIdFromString',
	'calculatePayment',
	'calculateProjectedAssetBalances',
	'compareAccounts',
	'compareMoney',
	'createCockpitForm',
	'deriveCockpit',
	'findAdjacentActiveAccount',
	'formatMoney',
	'getAssetThresholdState',
	'getCockpitDraftData',
	'getNextAccountSortOrder',
	'hydrateCockpitForm',
	'isValidAccountSortOrder',
	'isoTimestampFromString',
	'moneyFromMinorUnits',
	'normalizeAccountName',
	'parseMoneyInput',
	'paymentRecordIdFromString',
	'resolveAssetThresholds',
	'selectAccountHistory',
	'selectActiveAccounts',
	'selectArchivedAccounts',
	'sessionIdFromString',
	'sitDownDateFromString',
	'sortAccounts',
	'subtractMoney',
	'sumMoney',
	'validateAccountName',
	'validateAssetThresholdPolicy',
	'validateAssetThresholds',
	'validateDraftSession',
	'validateStandUpSession'
].sort();

describe('public domain API', () => {
	it('exports only the intentional runtime API from the domain barrel', () => {
		expect(Object.keys(domainApi).sort()).toEqual(expectedRuntimeExports);
		expect(domainApi).not.toHaveProperty('createIssue');
	});

	it('re-exports the same intentional runtime API through $lib', () => {
		expect(Object.keys(libApi).sort()).toEqual(expectedRuntimeExports);
		expect(libApi).not.toHaveProperty('createIssue');
	});
});
