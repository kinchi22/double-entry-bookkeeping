// VIOLATION: copy passed as a string attribute. No list of copy attributes names
// `heading`, and none has to: an attribute is copy unless its name is listed as
// markup. Expected gate: eslint, rule repo/no-inline-copy.
export function Section(): unknown {
  return <section heading="Pipeline health" />;
}
