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

    find: async (
      tokenHash: SessionTokenHash,
    ): Promise<Result<StoredSession | undefined, DomainError>> => {
      try {
        const [row] = await database
          .select({
            userId: schema.sessions.userId,
            expiresAt: schema.sessions.expiresAt,
            slides: sql<boolean>`exists (select 1 from identities where identities.user_id = sessions.user_id)`,
          })
          .from(schema.sessions)
          .where(eq(schema.sessions.tokenHash, tokenHash));
        return ok(
          row === undefined
            ? undefined
            : {
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
