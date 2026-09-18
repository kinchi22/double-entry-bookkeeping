-- ADR-0021, the contract step: entries written before there were Users have
-- none, and the code since milestone/authentication never reads them. Deleting
-- them is the wipe ADR-0009 promised; their lines go with them (ON DELETE
-- CASCADE on entry_lines). Hand-written: drizzle-kit generates only the ALTER.
DELETE FROM "entries" WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "user_id" SET NOT NULL;
