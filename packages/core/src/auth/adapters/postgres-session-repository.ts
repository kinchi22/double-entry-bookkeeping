import { eq, sql } from 'drizzle-orm';
import { ok, type DomainError, type Result, type UserId } from '@repo/contracts';
import { createDatabase, schema } from '@repo/db';
import { type Logger } from '../../logging/ports/logger';
import { type Session, type SessionTokenHash, type StoredSession } from '../domain/session';
import { type SessionRepository } from '../ports/session-repository';
import { databaseFailure } from './database-failure';

export type PostgresSessionRepository = SessionRepository & {
  close: () => Promise<void>;
};

/**
 * Sessions in Postgres, by the hash of their token. ADR-0021.
 *
 * A failure is logged without the hash: it is not the token, and it is still
 * the one value that names a live Session.
 */
export function createPostgresSessionRepository(
  connectionString: string,
  logger: Logger,
): PostgresSessionRepository {
  const { database, close } = createDatabase(connectionString);

  return {
    add: async (session: Session): Promise<Result<void, DomainError>> => {
      try {
        await database.insert(schema.sessions).values(session);
        return ok(undefined);
      } catch (error) {
        return databaseFailure(
          logger,
          'auth.add_session_failed',
          error,
          'The Session could not be stored.',
        );
      }
    },

    /**
     * A Session slides unless its User has no Identity: the Smoke User, whose
     * Session is seeded with a fixed expiry.
     */
    find: async (
      tokenHash: SessionTokenHash,
    ): Promise<Result<StoredSession | undefined, DomainError>> => {
      try {
        const [row] = await database
          .select({
            userId: schema.sessions.userId,
            expiresAt: schema.sessions.expiresAt,
            // Spelled out: inside a subquery Drizzle renders a column without
            // its table, and `user_id = user_id` would compare identities to
            // themselves.
            slides: sql<boolean>`exists (select 1 from identities where identities.user_id = sessions.user_id)`,
          })
          .from(schema.sessions)
          .where(eq(schema.sessions.tokenHash, tokenHash));
        return ok(
          row === undefined
            ? undefined
            : // The column is a uuid only a UserId is written to.
              {
                tokenHash,
                userId: row.userId as UserId,
                expiresAt: row.expiresAt,
                slides: row.slides,
              },
        );
      } catch (error) {
        return databaseFailure(
          logger,
          'auth.find_session_failed',
          error,
          'The Session could not be read.',
        );
      }
    },

    renew: async (
      tokenHash: SessionTokenHash,
      expiresAt: Date,
    ): Promise<Result<void, DomainError>> => {
      try {
        await database
          .update(schema.sessions)
          .set({ expiresAt })
          .where(eq(schema.sessions.tokenHash, tokenHash));
        return ok(undefined);
      } catch (error) {
        return databaseFailure(
          logger,
          'auth.renew_session_failed',
          error,
          'The Session could not be renewed.',
        );
      }
    },

    remove: async (tokenHash: SessionTokenHash): Promise<Result<void, DomainError>> => {
      try {
        await database.delete(schema.sessions).where(eq(schema.sessions.tokenHash, tokenHash));
        return ok(undefined);
      } catch (error) {
        return databaseFailure(
          logger,
          'auth.remove_session_failed',
          error,
          'The Session could not be ended.',
        );
      }
    },

    close,
  };
}
