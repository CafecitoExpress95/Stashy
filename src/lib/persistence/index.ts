export { ConfigurationRepositoryError } from './configuration-repository';
export type {
	ConfigurationRepository,
	ConfigurationRepositoryErrorCode,
	ConfigurationSnapshot,
	CreateAccountInput,
	UpdateAccountInput
} from './configuration-repository';
export {
	IndexedDbConfigurationRepository,
	createBrowserConfigurationRepository
} from './indexeddb-configuration-repository';
export {
	ACCOUNTS_STORE,
	APP_SETTINGS_ID,
	APP_SETTINGS_STORE,
	STASHY_DATABASE_NAME,
	STASHY_DATABASE_VERSION,
	applyDatabaseMigrations,
	deleteStashyDatabase
} from './schema';
