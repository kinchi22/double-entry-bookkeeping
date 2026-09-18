import { type DomainError, type Result, type UserId } from '@repo/contracts';
import { type Identity, type Profile, type User } from '../domain/user';

/**
 * Where Users and their Identities are kept, stated in domain terms.
 *
 * Two implementations exist: the Postgres adapter and the in-memory stub the
 * use case tests run against.
 *
 * A User owns its Identities (ADR-0011), so a User is added together with the
 * Identity it signed up by, or not at all.
 */
export type UserRepository = {
  /** The User an Identity belongs to, or `undefined` when it belongs to nobody. */
  readonly findByIdentity: (identity: Identity) => Promise<Result<User | undefined, DomainError>>;
  /**
   * Stores a new User and its first Identity, atomically. `CONFLICT` when the
   * Identity already belongs to a User, which two first sign-ins at once can
   * cause.
   */
  readonly add: (user: User, identity: Identity) => Promise<Result<void, DomainError>>;
  /** Records what the provider said about the User at their latest sign-in. */
  readonly updateProfile: (userId: UserId, profile: Profile) => Promise<Result<void, DomainError>>;
};
