/**
 * A single thing whose reachability can be checked.
 *
 * The use case depends on this shape; adapters supply it. Two implementations
 * already exist -- the Postgres probe and the stub used by unit tests -- so this
 * interface is describing reality rather than anticipating it.
 */
export type HealthProbe = {
  readonly name: string;
  check: () => Promise<boolean>;
};
