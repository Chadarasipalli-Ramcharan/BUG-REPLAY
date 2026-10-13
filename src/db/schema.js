import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const eventTypes = pgEnum("event_type", [
  "session_start",
  "click",
  "navigation",
  "console_error",
  "unhandled_error",
  "network_error",
  "http_error",
  "custom_event",
  "session_end",
]);

export const sessionEnvironments = pgEnum("session_environment", [
  "development",
  "staging",
  "production",
]);

export const issueStatuses = pgEnum("issue_status", [
  "open",
  "acknowledged",
  "resolved",
]);

export const issueSeverities = pgEnum("issue_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    pageUrl: text("page_url").notNull().default("/"),
    browserName: text("browser_name"),
    browserVersion: text("browser_version"),
    osName: text("os_name"),
    deviceType: text("device_type"),
    environment: sessionEnvironments("environment")
      .notNull()
      .default("development"),
    eventCount: integer("event_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    anomalyScore: integer("anomaly_score"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("sessions_started_at_idx").on(t.startedAt),
    index("sessions_project_idx").on(t.projectId),
    index("sessions_environment_idx").on(t.environment),
    index("sessions_error_count_idx").on(t.errorCount),
  ]
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    at: timestamp("timestamp", { withTimezone: true }).notNull(),
    type: eventTypes("event_type").notNull(),
    pageUrl: text("page_url").notNull().default("/"),
    name: text("event_name"),
    selector: text("target_selector"),
    payload: jsonb("payload").notNull().default({}),
    seq: integer("sequence_number").notNull(),
    idempotencyKey: text("idempotency_key").unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("events_session_seq_idx").on(t.sessionId, t.seq),
    index("events_at_idx").on(t.at),
    index("events_type_idx").on(t.type),
  ]
);

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    fingerprint: text("fingerprint").notNull(),
    title: text("title").notNull(),
    errorType: text("error_type").notNull(),
    message: text("message").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    affectedSessionCount: integer("affected_session_count").notNull().default(1),
    status: issueStatuses("status").notNull().default("open"),
    severity: issueSeverities("severity").notNull().default("medium"),
    latestStackTrace: text("latest_stack_trace"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("issues_project_fingerprint_uq").on(t.projectId, t.fingerprint),
    index("issues_status_idx").on(t.status),
    index("issues_severity_idx").on(t.severity),
    index("issues_last_seen_idx").on(t.lastSeenAt),
  ]
);

// Links issues to the exact sessions/events that produced them.
// Repeated occurrences add rows here; the issue row itself is updated in place.
export const issueOccurrences = pgTable(
  "issue_occurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("occurrences_issue_idx").on(t.issueId, t.occurredAt),
    index("occurrences_session_idx").on(t.sessionId),
    index("occurrences_event_idx").on(t.eventId),
  ]
);

// Fixed identifier for the default local demo project.
export const DEMO_PROJECT_SLUG = "demo-project";
export const DEMO_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
