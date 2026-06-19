declare const moneyBrand: unique symbol;

export type Money = number & {
	readonly [moneyBrand]: true;
};

export type MoneyParseErrorCode = 'empty' | 'malformed' | 'unexpected-precision' | 'overflow';

export type MoneyParseResult =
	| { readonly ok: true; readonly value: Money }
	| {
			readonly ok: false;
			readonly code: MoneyParseErrorCode;
			readonly message: string;
	  };

export class MoneyInvariantError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MoneyInvariantError';
	}
}

export const ZERO_MONEY = 0 as Money;

export function moneyFromMinorUnits(value: number): Money {
	if (!Number.isSafeInteger(value)) {
		throw new MoneyInvariantError('Money must be represented by a safe integer number of cents.');
	}

	return value as Money;
}

export function addMoney(left: Money, right: Money): Money {
	return moneyFromMinorUnits(left + right);
}

export function subtractMoney(left: Money, right: Money): Money {
	return moneyFromMinorUnits(left - right);
}

export function sumMoney(values: readonly Money[]): Money {
	return values.reduce((total, value) => addMoney(total, value), ZERO_MONEY);
}

export function compareMoney(left: Money, right: Money): -1 | 0 | 1 {
	if (left < right) {
		return -1;
	}

	if (left > right) {
		return 1;
	}

	return 0;
}

export function parseMoneyInput(input: string): MoneyParseResult {
	const normalized = input.trim();
	if (normalized.length === 0) {
		return {
			ok: false,
			code: 'empty',
			message: 'Enter a money amount.'
		};
	}

	const precisionMatch = normalized.match(/\.(\d+)$/);
	if (precisionMatch?.[1] && precisionMatch[1].length > 2) {
		return {
			ok: false,
			code: 'unexpected-precision',
			message: 'Money amounts can have no more than two decimal places.'
		};
	}

	const match = normalized.match(
		/^(-)?\$?((?:\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?|\.(\d{1,2}))$/
	);
	if (!match) {
		return {
			ok: false,
			code: 'malformed',
			message: 'Enter a valid amount such as 1000.10 or $1,000.10.'
		};
	}

	const sign = match[1] ? -1n : 1n;
	const numericBody = match[2].replaceAll(',', '');
	const [wholePart = '0', decimalPartFromBody] = numericBody.split('.');
	const decimalPart = decimalPartFromBody ?? match[4] ?? '';
	const normalizedWholePart = wholePart.length === 0 ? '0' : wholePart;
	const centsText = decimalPart.padEnd(2, '0');
	const minorUnits = sign * (BigInt(normalizedWholePart) * 100n + BigInt(centsText || '0'));

	if (
		minorUnits > BigInt(Number.MAX_SAFE_INTEGER) ||
		minorUnits < BigInt(Number.MIN_SAFE_INTEGER)
	) {
		return {
			ok: false,
			code: 'overflow',
			message: 'That amount is too large to store safely.'
		};
	}

	return {
		ok: true,
		value: moneyFromMinorUnits(Number(minorUnits))
	};
}

export function formatMoney(value: Money): string {
	const minorUnits = BigInt(value);
	const isNegative = minorUnits < 0n;
	const absoluteMinorUnits = isNegative ? -minorUnits : minorUnits;
	const wholePart = (absoluteMinorUnits / 100n).toString();
	const centsPart = (absoluteMinorUnits % 100n).toString().padStart(2, '0');
	const groupedWholePart = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

	return `${isNegative ? '-' : ''}$${groupedWholePart}.${centsPart}`;
}
