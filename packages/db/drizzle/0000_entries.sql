CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entry_date" date NOT NULL,
	"memo" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entry_lines" (
	"entry_id" uuid NOT NULL,
	"line_number" smallint NOT NULL,
	"account" text NOT NULL,
	"side" text NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "entry_lines_entry_id_line_number_pk" PRIMARY KEY("entry_id","line_number")
);
--> statement-breakpoint
ALTER TABLE "entry_lines" ADD CONSTRAINT "entry_lines_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE no action ON UPDATE no action;