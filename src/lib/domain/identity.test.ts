import { describe, expect, it } from 'vitest';
import {
	IdentityFormatError,
	accountIdFromString,
	isoTimestampFromString,
	sitDownDateFromString
} from './identity';

describe('identity value constructors', () => {
	it('accepts stable UUIDs, UTC timestamps, and real calendar dates', () => {
		expect(accountIdFromString('00000000-0000-4000-8000-000000000001')).toBe(
			'00000000-0000-4000-8000-000000000001'
		);
		expect(isoTimestampFromString('2026-06-18T12:30:45.123Z')).toBe('2026-06-18T12:30:45.123Z');
		expect(sitDownDateFromString('2026-02-28')).toBe('2026-02-28');
	});

	it('rejects malformed identifiers and dates', () => {
		expect(() => accountIdFromString('not-an-id')).toThrow(IdentityFormatError);
		expect(() => isoTimestampFromString('2026-06-18T12:30:45-04:00')).toThrow(IdentityFormatError);
		expect(() => sitDownDateFromString('2026-02-30')).toThrow(IdentityFormatError);
	});
});
