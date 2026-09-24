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

const UNIQUE_VIOLATION = '23505';

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
