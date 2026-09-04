/**
 * Nominal typing on top of a structural type system.
 *
 * TypeScript compares types by shape, so a plain `number` amount and a plain
 * `number` quantity are interchangeable, and a raw `string` id fits anywhere a
 * different raw `string` id is expected. Those are the two mistakes that are
 * expensive in a ledger, and both disappear once the type carries a name.
 *
 * The brand is a declared symbol that exists only in the type system: it is
 * erased at compile time, so a branded value is the underlying primitive at
 * runtime with no wrapper and no cost.
 */
declare const brand: unique symbol;

export type Brand<TValue, TBrand extends string> = TValue & {
  readonly [brand]: TBrand;
};
