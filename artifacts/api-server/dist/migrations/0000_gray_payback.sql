CREATE TYPE "public"."assignment_status" AS ENUM('pending_invite', 'active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."club_membership_role" AS ENUM('owner', 'manager');--> statement-breakpoint
CREATE TYPE "public"."match_event_type" AS ENUM('goal', 'score_correction', 'chukker_start', 'chukker_end', 'match_start', 'match_end', 'clock_start', 'clock_pause', 'penalty', 'horse_change', 'safety', 'injury_timeout', 'bowl_in', 'knock_in', 'foul', 'penalty_goal', 'shot_on_goal');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'live', 'halftime', 'final', 'postponed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tournament_format" AS ENUM('round_robin', 'single_elim', 'double_elim', 'group_knockout', 'swiss');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('draft', 'published', 'in_progress', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('spectator', 'team_manager', 'admin', 'super_admin');--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"logo_url" text,
	"logo_96_url" text,
	"logo_40_url" text,
	"logo_initials" varchar(2),
	"description" text,
	"website" varchar(500),
	"country" varchar(100),
	"region" varchar(100),
	"sponsored" boolean DEFAULT false,
	"sponsored_rank" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "clubs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" varchar(255),
	"number" integer,
	"lat" numeric,
	"lng" numeric,
	"zipcode" varchar(20),
	"image_url" text,
	"surface_type" varchar(100),
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid,
	"name" varchar(255) NOT NULL,
	"short_name" varchar(8),
	"logo_url" text,
	"logo_thumb_url" text,
	"primary_color" varchar(7),
	"handicap" numeric,
	"scoreboard_name" varchar(12),
	"contact_name" varchar(255),
	"contact_phone" varchar(50),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255),
	"display_name" varchar(255),
	"phone" varchar(50),
	"avatar_url" text,
	"role" "user_role" DEFAULT 'spectator',
	"password_hash" text,
	"google_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid,
	"name" varchar(255) NOT NULL,
	"format" "tournament_format",
	"handicap_level" varchar(50),
	"start_date" date,
	"end_date" date,
	"finals_date" date,
	"status" "tournament_status" DEFAULT 'draft',
	"match_duration_min" integer DEFAULT 90,
	"gap_between_min" integer DEFAULT 20,
	"chukkers_per_match" integer DEFAULT 6,
	"chukker_duration_minutes" integer DEFAULT 7,
	"has_third_place" boolean DEFAULT true,
	"schedule_config" jsonb,
	"ai_recommendation" jsonb,
	"is_visiting_league" boolean DEFAULT false,
	"sponsored" boolean DEFAULT false,
	"sponsored_rank" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"mvp_team_id" uuid,
	"mvp_player_id" uuid,
	"mvp_games_override" integer,
	"mvp_goals_override" integer,
	"bpp_team_id" uuid,
	"bpp_player_id" uuid,
	"bpp_horse_id" uuid,
	"bpp_display_settings" jsonb,
	"bpp_games_override" integer
);
--> statement-breakpoint
CREATE TABLE "tournament_teams" (
	"tournament_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"seed" integer,
	"group_label" varchar(10),
	"max_games_per_day" integer DEFAULT 2,
	"manual_wins" integer,
	"manual_losses" integer,
	"manual_net_goals" integer,
	"manual_gross_goals" integer,
	CONSTRAINT "tournament_teams_tournament_id_team_id_pk" PRIMARY KEY("tournament_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "team_out_dates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"tournament_id" uuid,
	"out_date" date NOT NULL,
	"reason" varchar(500),
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "play_dates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"field_ids" jsonb,
	"lunch_start" time,
	"lunch_end" time
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"home_team_id" uuid,
	"away_team_id" uuid,
	"field_id" uuid,
	"scheduled_at" timestamp with time zone,
	"home_score" integer DEFAULT 0,
	"away_score" integer DEFAULT 0,
	"current_chukker" integer DEFAULT 1,
	"clock_started_at" timestamp with time zone,
	"clock_elapsed_seconds" integer DEFAULT 0,
	"clock_is_running" boolean DEFAULT false,
	"status" "match_status" DEFAULT 'scheduled',
	"round" varchar(100),
	"bracket_position" integer,
	"is_locked" boolean DEFAULT false,
	"notes" text,
	"broadcast_visible" boolean DEFAULT false,
	"broadcast_style" varchar(20) DEFAULT 'option1',
	"broadcast_resolution" varchar(10) DEFAULT '1080p',
	"broadcast_4k_scale" integer DEFAULT 100,
	"broadcast_4k_offset_x" integer DEFAULT 0,
	"broadcast_4k_offset_y" integer DEFAULT 0,
	"broadcast_channel" varchar(8),
	"last_goal_scorer_name" varchar(255),
	"last_goal_team_side" varchar(10),
	"last_goal_timestamp" timestamp with time zone,
	"stream_url" text,
	"possession_token" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"event_type" "match_event_type" NOT NULL,
	"team_id" uuid,
	"player_id" uuid,
	"player_name" varchar(255),
	"chukker" integer,
	"clock_seconds" integer,
	"description" varchar(255),
	"score_snapshot" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_club_memberships" (
	"user_id" uuid NOT NULL,
	"club_id" uuid NOT NULL,
	"role" "club_membership_role" NOT NULL,
	"assigned_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "admin_club_memberships_user_id_club_id_pk" PRIMARY KEY("user_id","club_id")
);
--> statement-breakpoint
CREATE TABLE "team_manager_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"team_id" uuid NOT NULL,
	"tournament_id" uuid,
	"assigned_by" uuid,
	"invite_email" varchar(255),
	"status" "assignment_status" DEFAULT 'pending_invite',
	"created_at" timestamp with time zone DEFAULT now(),
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "spectator_follows" (
	"user_id" uuid NOT NULL,
	"club_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "spectator_follows_user_id_club_id_pk" PRIMARY KEY("user_id","club_id")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"fcm_token" varchar(500),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255),
	"team_manager_assignment_id" uuid,
	"club_membership_user_id" uuid,
	"club_membership_club_id" uuid,
	"token" varchar(255),
	"expires_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"sent_by" uuid,
	CONSTRAINT "user_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"handicap" numeric,
	"is_active" boolean DEFAULT true NOT NULL,
	"headshot_url" text,
	"date_of_birth" date,
	"home_club_id" uuid,
	"bio" text,
	"managed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"season_year" integer NOT NULL,
	"position" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "team_players_team_player_season_unique" UNIQUE("team_id","player_id","season_year")
);
--> statement-breakpoint
CREATE TABLE "horses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"horse_name" varchar(255) NOT NULL,
	"owner" varchar(255),
	"breeder" varchar(255),
	"owned_and_bred_by" varchar(255),
	"sire" varchar(255),
	"dam" varchar(255),
	"age" integer,
	"color" varchar(50),
	"sex" varchar(20),
	"type_or_breed" varchar(255),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "possession_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"possession_state" varchar(20) NOT NULL,
	"chukker" integer,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "field_weather_cache" (
	"field_id" uuid PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"is_error" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_payload" jsonb
);
--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_out_dates" ADD CONSTRAINT "team_out_dates_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_out_dates" ADD CONSTRAINT "team_out_dates_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_out_dates" ADD CONSTRAINT "team_out_dates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_dates" ADD CONSTRAINT "play_dates_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_club_memberships" ADD CONSTRAINT "admin_club_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_club_memberships" ADD CONSTRAINT "admin_club_memberships_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_club_memberships" ADD CONSTRAINT "admin_club_memberships_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_manager_assignments" ADD CONSTRAINT "team_manager_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_manager_assignments" ADD CONSTRAINT "team_manager_assignments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_manager_assignments" ADD CONSTRAINT "team_manager_assignments_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_manager_assignments" ADD CONSTRAINT "team_manager_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spectator_follows" ADD CONSTRAINT "spectator_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spectator_follows" ADD CONSTRAINT "spectator_follows_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invites" ADD CONSTRAINT "user_invites_team_manager_assignment_id_team_manager_assignments_id_fk" FOREIGN KEY ("team_manager_assignment_id") REFERENCES "public"."team_manager_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invites" ADD CONSTRAINT "user_invites_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_home_club_id_clubs_id_fk" FOREIGN KEY ("home_club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_managed_by_user_id_users_id_fk" FOREIGN KEY ("managed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_players" ADD CONSTRAINT "team_players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_players" ADD CONSTRAINT "team_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horses" ADD CONSTRAINT "horses_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "possession_segments" ADD CONSTRAINT "possession_segments_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "possession_segments" ADD CONSTRAINT "possession_segments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_weather_cache" ADD CONSTRAINT "field_weather_cache_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;