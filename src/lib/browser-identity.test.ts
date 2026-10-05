import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	accountIdFromString,
	accountRecordIdFromString,
	appSettingsIdFromString,
	auditEntryIdFromString,
	paymentRecordIdFromString,
	sessionIdFromString
} from '$lib/domain';
import { createBrowserUuid } from './browser-identity';

afterEach(() => vi.unstubAllGlobals());

describe('browser UUID generation', () => {
	it('prefers native randomUUID and preserves its Crypto receiver', () => {
		const expected = 'a0000000-0000-4000-8000-000000000001';
		const browserCrypto = {
			randomUUID() {
				expect(this).toBe(browserCrypto);
				return expected;
			},
			getRandomValues: vi.fn()
		};
		vi.stubGlobal('crypto', browserCrypto);
		expect(createBrowserUuid()).toBe(expected);
		expect(browserCrypto.getRandomValues).not.toHaveBeenCalled();
	});

	it.each([
		{ bytes: Array<number>(16).fill(0), expected: '00000000-0000-4000-8000-000000000000' },
		{ bytes: Array<number>(16).fill(255), expected: 'ffffffff-ffff-4fff-bfff-ffffffffffff' },
		{
			bytes: Array.from({ length: 16 }, (_, index) => index),
			expected: '00010203-0405-4607-8809-0a0b0c0d0e0f'
		}
	])(
		'formats secure random bytes as $expected accepted by every ID boundary',
		({ bytes, expected }) => {
			const browserCrypto = {
				getRandomValues(buffer: Uint8Array) {
					expect(this).toBe(browserCrypto);
					expect(buffer).toBeInstanceOf(Uint8Array);
					expect(buffer.byteLength).toBe(16);
					buffer.set(bytes);
					return buffer;
				}
			};
			vi.stubGlobal('crypto', browserCrypto);
			const id = createBrowserUuid();
			expect(id).toBe(expected);
			for (const validate of [
				accountIdFromString,
				accountRecordIdFromString,
				appSettingsIdFromString,
				auditEntryIdFromString,
				paymentRecordIdFromString,
				sessionIdFromString
			]) {
				expect(validate(id)).toBe(expected);
			}
		}
	);

	it.each([undefined, {}, { randomUUID: undefined, getRandomValues: undefined }])(
		'fails honestly without a secure random source (%j)',
		(browserCrypto) => {
			vi.stubGlobal('crypto', browserCrypto);
			expect(() => createBrowserUuid()).toThrow('secure random generation is unavailable');
		}
	);

	it('propagates secure random failures instead of returning an unfilled UUID', () => {
		vi.stubGlobal('crypto', {
			getRandomValues() {
				throw new Error('Random generator failed.');
			}
		});
		expect(() => createBrowserUuid()).toThrow('Random generator failed.');
	});
});
