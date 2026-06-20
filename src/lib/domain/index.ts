/** Intentional public surface for the pure Phase 1 domain layer. */
export { calculatePayment, calculateProjectedAssetBalances } from './calculations';
export type { AssetOpeningBalance, ProjectedAssetBalance } from './calculations';

export {
	IdentityFormatError,
	accountIdFromString,
	accountRecordIdFromString,
	appSettingsIdFromString,
	auditEntryIdFromString,
	isoTimestampFromString,
	paymentRecordIdFromString,
	sessionIdFromString,
	sitDownDateFromString
} from './identity';
export type {
	AccountId,
	AccountRecordId,
	AppSettingsId,
	AuditEntryId,
	EntityId,
	IsoTimestamp,
	PaymentRecordId,
	SessionId,
	SitDownDate
} from './identity';

export type { DomainIssue, DomainIssueCode, DomainIssueSeverity, DomainResult } from './issues';

export {
	MoneyInvariantError,
	ZERO_MONEY,
	addMoney,
	compareMoney,
	formatMoney,
	moneyFromMinorUnits,
	parseMoneyInput,
	subtractMoney,
	sumMoney
} from './money';
export type { Money, MoneyParseErrorCode, MoneyParseResult } from './money';

export { selectAccountHistory } from './selectors';
export type {
	AccountHistoryDatapoint,
	AccountHistoryInput,
	AccountHistoryPaymentDetails
} from './selectors';

export {
	getAssetThresholdState,
	resolveAssetThresholds,
	validateAssetThresholds
} from './thresholds';
export type { AssetThresholdState } from './thresholds';

export type {
	Account,
	AccountRecord,
	AccountRecordAuditEntry,
	AppSettings,
	AssetAccount,
	AssetThresholdPolicy,
	AssetThresholds,
	AuditEntry,
	DraftAccountRecord,
	DraftPaymentRecord,
	LiabilityAccount,
	PaymentMode,
	PaymentRecord,
	PaymentRecordAuditEntry,
	RecordTimestamps,
	Session,
	SessionAuditEntry
} from './types';

export { validateDraftSession, validateStandUpSession } from './validation';
export type { SessionValidationInput, SessionValidationResult } from './validation';
