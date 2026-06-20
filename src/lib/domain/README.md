# Phase 1 Domain Layer

This directory contains Stashy's UI-independent money and record rules. It deliberately knows nothing about Svelte, IndexedDB, or route components.

## Data Flow

1. `identity.ts` validates IDs and dates, while `money.ts` converts typed text into exact integer cents.
2. The cockpit will assemble the flat draft records defined in `types.ts`.
3. `calculations.ts` resolves complete payment rows and projects each source asset after planned payments.
4. `validation.ts` keeps draft omissions separate from hard data errors and financial warnings.
5. Saved `AccountRecord` snapshots feed `selectors.ts`; history never invents missing transactions.
6. `thresholds.ts` turns an asset's effective thresholds into passive healthy, warning, or danger colors.

## TypeScript Notation Used Here

- `readonly` means domain functions may read a field but should not mutate it.
- `field?: Type` means a draft may omit that field. `Type | null` means the field exists but intentionally has no value.
- `A | B` is a union: a value is one documented shape or the other. Fields such as `type`, `mode`, and `ok` identify the active shape.
- `A & B` composes fields from two types into one flat object. It does not create a class hierarchy or nested storage shape.
- Branded types such as `Money` and `AccountId` are ordinary numbers or strings with compile-time tags that prevent accidental mixing.
- `DomainResult<Value>` is either `{ ok: true, value }` or `{ ok: false, errors }`. Checking `ok` tells TypeScript which fields are safe to use.

## Composition and Runtime Shape

Shared fragments such as `RecordTimestamps` remove repeated type declarations. They are combined with `&`, but the runtime records remain plain flat objects:

```ts
{
	(id, createdAt, updatedAt, sessionId, accountId);
}
```

No timestamp wrapper, base-class instance, or hidden inherited state is persisted. The only classes in this directory are JavaScript `Error` subclasses so callers can catch boundary failures normally.

## Reading the Rules

Comments focus on domain intent and non-obvious TypeScript mechanics. Tests remain the executable contract for exact cents, payment modes, warning behavior, threshold boundaries, and snapshot history.
