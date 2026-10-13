// Deterministic demo dataset. Safe to call repeatedly: if the anchor session
// already exists the whole seed is skipped (no uncontrolled duplication).

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  sessions,
  events,
  issues,
  issueOccurrences,
  DEMO_PROJECT_SLUG,
} from "@/db/schema";
import { getOrCreateProject } from "./api-utils.js";
import { upsertIssueInTx } from "./pipeline.js";
import { classifyEvent, fingerprintFor } from "./fingerprint.js";
import { ERROR_TYPES, scoreSessionEvents } from "./analysis.js";

const DAY = 86400000;
const S = (n) => `7c9a4f20-8e1b-4d0c-a000-${String(n).padStart(12, "0")}`;
const SESSION_IDS = [S(1), S(2), S(3), S(4), S(5), S(6), S(7), S(8)];

const stackProfile = (line) =>
  `TypeError: Cannot read properties of undefined (reading 'customerName')\n` +
  `    at loadCustomerProfile (http://localhost:3000/static/app.js:${line}:23)\n` +
  `    at onClick (http://localhost:3000/static/app.js:88:15)\n` +
  `    at dispatchEvent (http://localhost:3000/static/react-dom.js:1452:19)`;

const stackOrderSummary =
  "TypeError: Cannot read properties of null (reading 'total')\n" +
  "    at renderOrderSummary (http://localhost:3000/static/app.js:231:9)\n" +
  "    at onClick (http://localhost:3000/static/app.js:91:15)";

const profileError = {
  type: "unhandled_error",
  name: "TypeError: Cannot read properties of undefined (reading 'customerName')",
  payload: (line) => ({
    message:
      "TypeError: Cannot read properties of undefined (reading 'customerName')",
    stack: stackProfile(line),
  }),
};

const order500 = (durationMs) => ({
  type: "http_error",
  name: "POST /api/orders/submit returned 500",
  selector: "button[data-br-id='place-order']",
  payload: {
    url: "/api/orders/submit",
    method: "POST",
    status: 500,
    durationMs,
  },
});

function plan(now) {
  const base = {
    pageUrl: "/demo",
    environment: "development",
  };
  return [
    {
      id: SESSION_IDS[0],
      daysAgo: 13,
      jitterMin: 12,
      ...base,
      browser: ["Chrome", "131.0.0.0", "Windows", "desktop"],
      events: [
        { offsetSec: 0, type: "session_start", name: null },
        { offsetSec: 2, type: "navigation", name: "pushState #shop" },
        {
          offsetSec: 5,
          type: "click",
          name: "Add to cart — Aurora Lamp",
          selector: "button[data-br-id='add-cart-lamp']",
        },
        {
          offsetSec: 6,
          type: "custom_event",
          name: "add_to_cart",
          payload: { sku: "LAMP-001" },
        },
        {
          offsetSec: 12,
          type: "click",
          name: "View cart",
          selector: "button[data-br-id='open-cart']",
          payload: { items: 1 },
        },
        {
          offsetSec: 20,
          type: "click",
          name: "Checkout",
          selector: "button[data-br-id='checkout']",
        },
        { offsetSec: 25, type: "navigation", name: "pushState #checkout" },
        {
          offsetSec: 30,
          type: "click",
          name: "Place order (works)",
          selector: "button[data-br-id='place-order']",
        },
        {
          offsetSec: 31,
          type: "custom_event",
          name: "order_placed",
          payload: { order: "BR-1042" },
        },
        { offsetSec: 40, type: "session_end", name: null },
      ],
    },
    {
      id: SESSION_IDS[1],
      daysAgo: 10,
      jitterMin: 45,
      ...base,
      browser: ["Safari", "18.2.0", "macOS", "desktop"],
      events: [
        { offsetSec: 0, type: "session_start", name: null },
        { offsetSec: 3, type: "navigation", name: "pushState #profile" },
        {
          offsetSec: 8,
          type: "click",
          name: "Load customer profile",
          selector: "button[data-br-id='load-profile']",
        },
        {
          offsetSec: 9,
          ...profileError,
          selector: "button[data-br-id='load-profile']",
          payload: profileError.payload(142),
        },
        {
          offsetSec: 12,
          type: "console_error",
          name: "Profile cache miss for customer 42",
          payload: { message: "Profile cache miss for customer 42" },
        },
        {
          offsetSec: 18,
          type: "click",
          name: "Retry",
          selector: "button[data-br-id='retry-profile']",
        },
        {
          offsetSec: 19,
          ...profileError,
          selector: "button[data-br-id='load-profile']",
          payload: profileError.payload(147),
        },
        { offsetSec: 26, type: "session_end", name: null },
      ],
    },
    {
      id: SESSION_IDS[2],
      daysAgo: 9,
      jitterMin: 5,
      pageUrl: "/demo",
      environment: "staging",
      browser: ["Firefox", "133.0.0", "Linux", "desktop"],
      events: [
        { offsetSec: 0, type: "session_start", name: null },
        { offsetSec: 4, type: "navigation", name: "pushState #orders" },
        {
          offsetSec: 9,
          type: "click",
          name: "Place order",
          selector: "button[data-br-id='place-order']",
        },
        { offsetSec: 10, ...order500(412) },
        {
          offsetSec: 11,
          type: "console_error",
          name: "Order submit failed with status 500",
          payload: { message: "Order submit failed with status 500" },
        },
        {
          offsetSec: 16,
          type: "click",
          name: "Place order (retry)",
          selector: "button[data-br-id='place-order']",
        },
        { offsetSec: 17, ...order500(388) },
        { offsetSec: 24, type: "session_end", name: null },
      ],
    },
    {
      id: SESSION_IDS[3],
      daysAgo: 7,
      jitterMin: 80,
      ...base,
      browser: ["Chrome", "131.0.0.0", "Android", "mobile"],
      events: [
        { offsetSec: 0, type: "session_start", name: null },
        { offsetSec: 5, type: "navigation", name: "pushState #reports" },
        {
          offsetSec: 11,
          type: "click",
          name: "Export report",
          selector: "button[data-br-id='export-report']",
        },
        {
          offsetSec: 14,
          type: "network_error",
          name: "GET /api/reports/export timed out",
          selector: "button[data-br-id='export-report']",
          payload: {
            url: "/api/reports/export",
            method: "GET",
            reason: "timeout",
            durationMs: 2500,
          },
        },
        { offsetSec: 20, type: "session_end", name: null },
      ],
    },
    {
      id: SESSION_IDS[4],
      daysAgo: 5,
      jitterMin: 30,
      ...base,
      browser: ["Safari", "18.2.0", "macOS", "desktop"],
      events: [
        { offsetSec: 0, type: "session_start", name: null },
        { offsetSec: 3, type: "navigation", name: "pushState #profile" },
        {
          offsetSec: 7,
          type: "click",
          name: "Load customer profile",
          selector: "button[data-br-id='load-profile']",
        },
        {
          offsetSec: 8,
          ...profileError,
          selector: "button[data-br-id='load-profile']",
          payload: profileError.payload(151),
        },
        { offsetSec: 14, type: "session_end", name: null },
      ],
    },
    {
      id: SESSION_IDS[5],
      daysAgo: 4,
      jitterMin: 15,
      ...base,
      browser: ["Chrome", "131.0.0.0", "Windows", "desktop"],
      events: [
        { offsetSec: 0, type: "session_start", name: null },
        {
          offsetSec: 2,
          type: "click",
          name: "Browse collection",
          selector: "a[data-br-id='collection']",
        },
        {
          offsetSec: 6,
          type: "click",
          name: "Open product — Nova Chair",
          selector: "a[data-br-id='product-chair']",
        },
        {
          offsetSec: 12,
          type: "custom_event",
          name: "page_view",
          payload: { page: "/products/nova-chair" },
        },
        { offsetSec: 18, type: "session_end", name: null },
      ],
    },
    {
      id: SESSION_IDS[6],
      daysAgo: 2,
      jitterMin: 55,
      ...base,
      browser: ["Edge", "131.0.0.0", "Windows", "desktop"],
      events: [
        { offsetSec: 0, type: "session_start", name: null },
        { offsetSec: 4, type: "navigation", name: "pushState #account" },
        {
          offsetSec: 9,
          type: "http_error",
          name: "GET /api/session/refresh returned 401",
          payload: {
            url: "/api/session/refresh",
            method: "GET",
            status: 401,
            durationMs: 96,
          },
        },
        {
          offsetSec: 10,
          type: "console_error",
          name: "Auth refresh failed (401) — session expired",
          payload: { message: "Auth refresh failed (401) — session expired" },
        },
        {
          offsetSec: 16,
          type: "click",
          name: "Sign in",
          selector: "button[data-br-id='sign-in']",
        },
        { offsetSec: 22, type: "session_end", name: null },
      ],
    },
    {
      id: SESSION_IDS[7],
      daysAgo: 1,
      jitterMin: 20,
      pageUrl: "/demo",
      environment: "staging",
      browser: ["Chrome", "131.0.0.0", "Windows", "desktop"],
      events: [
        { offsetSec: 0, type: "session_start", name: null },
        { offsetSec: 3, type: "navigation", name: "pushState #orders" },
        {
          offsetSec: 8,
          type: "click",
          name: "Place order",
          selector: "button[data-br-id='place-order']",
        },
        { offsetSec: 9, ...order500(431) },
        {
          offsetSec: 13,
          type: "click",
          name: "Open order summary",
          selector: "button[data-br-id='order-summary']",
        },
        {
          offsetSec: 14,
          type: "unhandled_error",
          name: "TypeError: Cannot read properties of null (reading 'total')",
          selector: "button[data-br-id='order-summary']",
          payload: {
            message: "TypeError: Cannot read properties of null (reading 'total')",
            stack: stackOrderSummary,
          },
        },
        { offsetSec: 20, type: "session_end", name: null },
      ],
    },
  ];
}

export async function seedDemoData() {
  const project = await getOrCreateProject(DEMO_PROJECT_SLUG);
  const [existing] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.id, SESSION_IDS[0]))
    .limit(1);
  if (existing) {
    return { alreadySeeded: true, project: project.slug, sessions: 8 };
  }

  return db.transaction(async (tx) => {
    const now = Date.now();
    const planData = plan(now);
    let sessionCount = 0;
    let eventCount = 0;
    const fpsToStatus = new Map();

    for (const s of planData) {
      const started = new Date(now - s.daysAgo * DAY - s.jitterMin * 60000);
      const [sess] = await tx
        .insert(sessions)
        .values({
          id: s.id,
          projectId: project.id,
          startedAt: started,
          pageUrl: s.pageUrl,
          browserName: s.browser[0],
          browserVersion: s.browser[1],
          osName: s.browser[2],
          deviceType: s.browser[3],
          environment: s.environment,
        })
        .returning();
      sessionCount += 1;

      let errCount = 0;
      const anomalyInput = [];
      for (let i = 0; i < s.events.length; i += 1) {
        const e = s.events[i];
        const at = new Date(started.getTime() + e.offsetSec * 1000);
        const [row] = await tx
          .insert(events)
          .values({
            sessionId: sess.id,
            at,
            type: e.type,
            pageUrl: e.pageUrl || s.pageUrl,
            name: e.name ?? null,
            selector: e.selector ?? null,
            payload: e.payload ?? {},
            seq: i + 1,
          })
          .returning({ id: events.id });
        eventCount += 1;
        anomalyInput.push({ type: e.type, name: e.name });
        if (ERROR_TYPES.has(e.type)) {
          errCount += 1;
          const cls = classifyEvent({
            type: e.type,
            name: e.name,
            payload: e.payload,
          });
          if (cls) {
            await upsertIssueInTx(tx, project.id, cls, {
              sessionId: sess.id,
              eventId: row.id,
              at,
            });
            const fp = fingerprintFor(cls.kind, cls.message, cls.stack);
            if (fp === fpOrder500) fpsToStatus.set(fp, "acknowledged");
            if (fp === fpAuth401) fpsToStatus.set(fp, "resolved");
          }
        }
      }

      const lastAt = new Date(
        started.getTime() + s.events[s.events.length - 1].offsetSec * 1000
      );
      const anomaly = scoreSessionEvents(anomalyInput);
      await tx
        .update(sessions)
        .set({
          endedAt: lastAt,
          eventCount: s.events.length,
          errorCount: errCount,
          anomalyScore: anomaly.score,
        })
        .where(eq(sessions.id, sess.id));
    }

    for (const [fp, status] of fpsToStatus) {
      await tx
        .update(issues)
        .set({ status, updatedAt: new Date() })
        .where(eq(issues.fingerprint, fp));
    }

    return {
      alreadySeeded: false,
      project: project.slug,
      sessions: sessionCount,
      events: eventCount,
    };
  });
}

export async function resetDemoData() {
  const project = await getOrCreateProject(DEMO_PROJECT_SLUG);
  // Only touches records owned by the demo project.
  return db.transaction(async (tx) => {
    const sessRows = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.projectId, project.id));
    let deletedSessions = 0;
    let deletedEvents = 0;
    let deletedOccurrences = 0;
    if (sessRows.length) {
      const occDeleted = await tx
        .delete(issueOccurrences)
        .where(inArray(issueOccurrences.sessionId, sessRows.map((r) => r.id)))
        .returning();
      deletedOccurrences = occDeleted.length;
      const evDeleted = await tx
        .delete(events)
        .where(inArray(events.sessionId, sessRows.map((r) => r.id)))
        .returning();
      deletedEvents = evDeleted.length;
      await tx.delete(sessions).where(inArray(sessions.id, sessRows.map((r) => r.id)));
      deletedSessions = sessRows.length;
    }
    const issDeleted = await tx
      .delete(issues)
      .where(eq(issues.projectId, project.id))
      .returning();
    return {
      deletedSessions,
      deletedEvents,
      deletedOccurrences,
      deletedIssues: issDeleted.length,
    };
  });
}

// Reference fingerprints computed once for the status plan above.
const clsOrder500 = classifyEvent({
  type: "http_error",
  name: "POST /api/orders/submit returned 500",
  payload: { url: "/api/orders/submit", method: "POST", status: 500 },
});
const fpOrder500 = fingerprintFor(clsOrder500.kind, clsOrder500.message, null);
const clsAuth401 = classifyEvent({
  type: "http_error",
  name: "GET /api/session/refresh returned 401",
  payload: { url: "/api/session/refresh", method: "GET", status: 401 },
});
const fpAuth401 = fingerprintFor(clsAuth401.kind, clsAuth401.message, null);
