/** Create a cryptographically random v4 UUID, including on local-network HTTP origins. */
export function createBrowserUuid(): string {
	const browserCrypto = globalThis.crypto;
	if (typeof browserCrypto?.randomUUID === 'function') return browserCrypto.randomUUID();
	if (typeof browserCrypto?.getRandomValues !== 'function') {
		throw new Error(
			'This browser cannot create stable IDs because secure random generation is unavailable.'
		);
	}

	// getRandomValues remains available outside secure contexts. Preserve all random
	// bits except the v4 version and RFC variant, matching native randomUUID IDs.
	const bytes = new Uint8Array(16);
	browserCrypto.getRandomValues(bytes);
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
