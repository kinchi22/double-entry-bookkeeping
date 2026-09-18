import { and, eq } from 'drizzle-orm';
import { domainError, err, ok, type DomainError, type Result, type UserId } from '@repo/contracts';
import { createDatabase, schema } from '@repo/db';
import { describeError } from '../../logging/domain/describe-error';
import { type Logger } from '../../logging/ports/logger';
import { type Identity, type Profile, type User } from '../domain/user';
import { type UserRepository } from '../ports/user-repository';
import { databaseFailure } from './database-failure';

export type PostgresUserRepository = UserRepository & {
  close: () => Promise<void>;
};

/** The SQLSTATE Postgres reports a duplicate key with. */
const UNIQUE_VIOLATION = '23505';

/**
 * Users in Postgres, found through `identities`. ADR-0021.
 *
 * It takes a connection string for the reason the health probe does: the
 * composition root may not import @repo/db. A database failure is a returned
 * `DEPENDENCY_UNAVAILABLE` with a generic message, and what went wrong goes to
 * the logger, never an email or a name. ADR-0018.
 */
export function createPostgresUserRepository(
  connectionString: string,
  logger: Logger,
): PostgresUserRepository {
  const { database, close } = createDatabase(connectionString);

  return {
    findByIdentity: async (identity: Identity): Promise<Result<User | undefined, DomainError>> => {
      try {
        const [row] = await database
          .select({ user: schema.users })
          .from(schema.identities)
          .innerJoin(schema.users, eq(schema.users.id, schema.identities.userId))
          .where(
            and(
              eq(schema.identities.provider, identity.provider),
              eq(schema.identities.providerSubject, identity.subject),
            ),
          );
        // The column is a uuid that only `add` writes, and it writes a UserId.
        return ok(row === undefined ? undefined : { ...row.user, id: row.user.id as UserId });
      } catch (error) {
        return databaseFailure(
          logger,
          'auth.find_user_failed',
          error,
          'The User could not be read.',
        );
      }
    },

    /** One transaction: a User with no Identity is one nobody can sign in as. */
    add: async (user: User, identity: Identity): Promise<Result<void, DomainError>> => {
      try {
        await database.transaction(async (transaction) => {
          await transaction.insert(schema.users).values(user);
          await transaction.insert(schema.identities).values({
            provider: identity.provider,
            providerSubject: identity.subject,
            userId: user.id,
          });
        });
        return ok(undefined);
      } catch (error) {
        // Two first sign-ins at once: the other one added the Identity. Not a
        // failure of this app, so not logged as one.
        if (describeError(error).code === UNIQUE_VIOLATION) {
          return err(domainError('CONFLICT', 'That Identity already belongs to a User.'));
        }
        return databaseFailure(
          logger,
          'auth.add_user_failed',
          error,
          'The User could not be stored.',
        );
      }
    },

    updateProfile: async (userId: UserId, profile: Profile): Promise<Result<void, DomainError>> => {
      try {
        await database
          .update(schema.users)
          .set({ email: profile.email, name: profile.name })
          .where(eq(schema.users.id, userId));
        return ok(undefined);
      } catch (error) {
        return databaseFailure(
          logger,
          'auth.update_profile_failed',
          error,
          'The User could not be updated.',
        );
      }
    },

    close,
  };
}
