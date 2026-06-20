/** Exact USD input, output, and arithmetic based on integer cents. */
declare const moneyBrand: unique symbol;

/**
 * A safe integer count of cents. The private brand prevents ordinary numbers
 * from being used as money without first passing an invariant check.
 */
export type Money = number & {
	readonly [moneyBrand]: true;
};

/** Stable reasons that user-entered money text can be rejected. */
export type MoneyParseErrorCode = 'empty' | 'malformed' | 'unexpected-precision' | 'overflow';

/** Either exact cents or a user-facing explanation of why parsing failed. */
export type MoneyParseResult =
	| { readonly ok: true; readonly value: Money }
	| {
			readonly ok: false;
			readonly code: MoneyParseErrorCode;
			readonly message: string;
	  };

/**
 * Thrown when code attempts to construct unsafe or non-integer money.
 * Extending Error is the standard JavaScript contract for catchable errors.
 */
export class MoneyInvariantError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MoneyInvariantError';
	}
}

export const ZERO_MONEY = 0 as Money;

const MONEY_INPUT_PATTERN =
	/^(?<negative>-)?\$?(?:(?<whole>\d+|\d{1,3}(?:,\d{3})+)(?:\.(?<fraction>\d{1,2}))?|\.(?<fractionWithoutWhole>\d{1,2}))$/;

type MoneyInputGroups = {
	readonly negative?: string;
	readonly whole?: string;
	readonly fraction?: string;
	readonly fractionWithoutWhole?: string;
};

/** Constructs money from a number that already represents cents. */
export function moneyFromMinorUnits(value: number): Money {
	if (!Number.isSafeInteger(value)) {
		throw new MoneyInvariantError('Money must be represented by a safe integer number of cents.');
	}

	return value as Money;
}

/** Adds two exact cent values and checks the result for overflow. */
export function addMoney(left: Money, right: Money): Money {
	return moneyFromMinorUnits(left + right);
}

/** Subtracts exact cents and checks the result for overflow. */
export function subtractMoney(left: Money, right: Money): Money {
	return moneyFromMinorUnits(left - right);
}

/** Adds a list of exact cent values. */
export function sumMoney(values: readonly Money[]): Money {
	return values.reduce((total, value) => addMoney(total, value), ZERO_MONEY);
}

/** Compares two money values without converting them to floating-point dollars. */
export function compareMoney(left: Money, right: Money): -1 | 0 | 1 {
	if (left < right) {
		return -1;
	}

	if (left > right) {
		return 1;
	}

	return 0;
}

/**
 * Parses common USD text into exact cents without rounding.
 *
 * Named regular-expression groups keep signs, dollars, and cents readable.
 * BigInt performs the decimal-to-cents conversion exactly before the result is
 * checked against JavaScript's safe-integer range.
 */
export function parseMoneyInput(input: string): MoneyParseResult {
	const normalizedInput = input.trim();
	if (normalizedInput.length === 0) {
		return {
			ok: false,
			code: 'empty',
			message: 'Enter a money amount.'
		};
	}

	const precisionMatch = normalizedInput.match(/\.(\d+)$/);
	if (precisionMatch?.[1] && precisionMatch[1].length > 2) {
		return {
			ok: false,
			code: 'unexpected-precision',
			message: 'Money amounts can have no more than two decimal places.'
		};
	}

	const match = MONEY_INPUT_PATTERN.exec(normalizedInput);
	if (!match?.groups) {
		return {
			ok: false,
			code: 'malformed',
			message: 'Enter a valid amount such as 1000.10 or $1,000.10.'
		};
	}

	const groups = match.groups as MoneyInputGroups;
	const sign = groups.negative ? -1n : 1n;
	const wholeDigits = (groups.whole ?? '0').replaceAll(',', '');
	const fractionDigits = groups.fraction ?? groups.fractionWithoutWhole ?? '';
	const paddedFractionDigits = fractionDigits.padEnd(2, '0');

	const minorUnits = sign * (BigInt(wholeDigits) * 100n + BigInt(paddedFractionDigits || '0'));

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

/** Formats exact cents as an en-US USD string without dollar-based arithmetic. */
export function formatMoney(value: Money): string {
	const minorUnits = BigInt(value);
	const isNegative = minorUnits < 0n;
	const absoluteMinorUnits = isNegative ? -minorUnits : minorUnits;
	const wholePart = (absoluteMinorUnits / 100n).toString();
	const centsPart = (absoluteMinorUnits % 100n).toString().padStart(2, '0');
	const groupedWholePart = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

	return `${isNegative ? '-' : ''}$${groupedWholePart}.${centsPart}`;
}
