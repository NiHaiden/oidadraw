CREATE TABLE "user_board" (
	"user_id" text NOT NULL,
	"board_id" text NOT NULL,
	"last_opened_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_board_user_id_board_id_pk" PRIMARY KEY("user_id","board_id")
);
--> statement-breakpoint
ALTER TABLE "user_board" ADD CONSTRAINT "user_board_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;