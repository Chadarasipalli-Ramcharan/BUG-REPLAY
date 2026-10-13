// BugReplay self-test: deterministic checks over the pure analysis,
// fingerprinting, severity, hint, anomaly and privacy modules.
// Run with: node scripts/selftest.mjs

import {
  normalizeMessage,
  topFrames,
  computeSeverity,
  diagnosticHints,
  scoreSessionEvents,
} from "../src/lib/analysis.js";
import { fingerprintFor, classifyEvent, issueTitleFor } from "../src/lib/fingerprint.js";
import { sanitizeUrl, scrubPayload } from "../src/lib/sanitize.js";

let pass = 0;
let fail = 0;
function check(name, cond, extra = "") {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name} ${extra}`);
  }
}

console.log("BugReplay self-test\n");

console.log("— Error normalization —");
check(
  "collapses whitespace",
  normalizeMessage("TypeError:    cannot   read  properties") ===
    "TypeError: cannot read properties"
);
check(
  "strips trailing line:col",
  normalizeMessage("boom at x.js:12:34") === "boom at x.js"
);
check(
  "same message with different line numbers normalizes identically",
  normalizeMessage("TypeError: x:11:5") === normalizeMessage("TypeError: x:99:1")
);

const stackA =
  "TypeError: Cannot read properties of undefined (reading 'customerName')\n" +
  "    at loadCustomerProfile (http://localhost:3000/static/app.js:142:23)\n" +
  "    at onClick (http://localhost:3000/static/app.js:88:15)";
const stackB =
  "TypeError: Cannot read properties of undefined (reading 'customerName')\n" +
  "    at loadCustomerProfile (http://localhost:3000/static/app.js:147:23)\n" +
  "    at onClick (http://localhost:3000/static/app.js:91:15)";
check(
  "topFrames strips line:col so same call chain matches across machines",
  JSON.stringify(topFrames(stackA, 2)) === JSON.stringify(topFrames(stackB, 2))
);
check(
  "topFrames keeps distinct functions distinct",
  JSON.stringify(topFrames(stackA, 1)) !==
    JSON.stringify(
      topFrames(
        "TypeError: Cannot read properties of null (reading 'total')\n    at renderOrderSummary (http://localhost:3000/static/app.js:231:9)",
        1
      )
    )
);

console.log("\n— Fingerprinting —");
const fp1 = fingerprintFor("javascript_error", stackA.split("\n")[0], stackA);
const fp2 = fingerprintFor("javascript_error", stackA.split("\n")[0], stackB);
check("deterministic: same logical error → same fingerprint", fp1 === fp2);
check(
  "distinct errors → distinct fingerprints",
  fp1 !==
    fingerprintFor(
      "javascript_error",
      "TypeError: Cannot read properties of null (reading 'total')",
      "at renderOrderSummary (app.js:231:9)"
    )
);
check(
  "same message but different kind → different fingerprint",
  fp1 !==
    fingerprintFor("console_error", stackA.split("\n")[0], stackA)
);

const cls500 = classifyEvent({
  type: "http_error",
  name: "POST /api/orders/submit returned 500",
  payload: { url: "/api/orders/submit?token=abc", method: "POST", status: 500 },
});
check("classifyEvent maps 500 → http_error", cls500.kind === "http_error");
check(
  "http error message drops sensitive query params",
  !cls500.message.includes("token") && cls500.message.includes("HTTP 500")
);
const clsTo = classifyEvent({
  type: "network_error",
  name: "GET /api/reports/export failed (AbortError)",
  payload: { url: "/api/reports/export", method: "GET", reason: "timeout" },
});
check("classifyEvent maps abort → network_error with timeout", clsTo.kind === "network_error" && clsTo.reason === "timeout");
check("issue title readable", issueTitleFor(cls500).startsWith("HTTP error:"));

console.log("\n— Severity rules —");
check("first 500 → medium", computeSeverity("http_error", { status: 500 }) === "medium");
check(
  "500 ×3 → high",
  computeSeverity("http_error", { status: 500, occurrenceCount: 3 }) === "high"
);
check(
  "500 ×8 → critical",
  computeSeverity("http_error", { status: 500, occurrenceCount: 8 }) === "critical"
);
check(
  "401 → medium",
  computeSeverity("http_error", { status: 401 }) === "medium"
);
check("404 → low", computeSeverity("http_error", { status: 404 }) === "low");
check("console error → low", computeSeverity("console_error", {}) === "low");
check("first unhandled JS error → medium", computeSeverity("unhandled_error", {}) === "medium");
check(
  "javascript_error ×2 sessions escalates to high",
  computeSeverity("javascript_error", { affectedSessions: 2 }) === "high"
);

console.log("\n— Diagnostic hints —");
const hints500 = diagnosticHints({
  errorType: "http_error",
  message: "HTTP 500 POST /api/orders/submit",
  latestStackTrace: null,
  occurrenceCount: 3,
  affectedSessionCount: 2,
});
check("500 produces server-log hint", hints500.some((h) => h.id === "http-5xx"));
check(
  "hints carry evidence",
  hints500.every((h) => typeof h.evidence === "string" && h.evidence.length > 0)
);
const hintsTo = diagnosticHints({
  errorType: "network_error",
  message: "Network failure (timeout) GET /api/reports/export",
  latestStackTrace: null,
  occurrenceCount: 1,
  affectedSessionCount: 1,
});
check("timeout produces network-timeout hint", hintsTo.some((h) => h.id === "net-timeout"));
const hintsTy = diagnosticHints({
  errorType: "javascript_error",
  message: "TypeError: Cannot read properties of undefined (reading 'customerName')",
  latestStackTrace: "at loadCustomerProfile (app.js)",
  occurrenceCount: 1,
  affectedSessionCount: 1,
});
check("TypeError produces property-access hint", hintsTy.some((h) => h.id === "js-typeerror"));

console.log("\n— Anomaly scoring —");
const clean = scoreSessionEvents([
  { type: "session_start" },
  { type: "click" },
  { type: "navigation" },
  { type: "click" },
  { type: "session_end" },
]);
check("clean session scores low", clean.score < 20 && clean.band === "low");
const abnormalInput = [
  { type: "session_start" },
  { type: "click" },
  { type: "unhandled_error", name: "TypeError: x" },
  { type: "unhandled_error", name: "TypeError: x" },
  { type: "unhandled_error", name: "TypeError: x" },
  { type: "http_error", name: "HTTP 500 POST /x" },
  { type: "network_error", name: "timeout" },
  { type: "session_end" },
];
const abnormal = scoreSessionEvents(abnormalInput);
check(
  "abnormal session scores high and reports contributors",
  abnormal.score >= 45 &&
    abnormal.features.errorCount === 5 &&
    abnormal.features.maxRepeatedError === 3 &&
    typeof abnormal.explanation === "string"
);
check(
  "score is deterministic",
  scoreSessionEvents(abnormalInput).score === abnormal.score
);

console.log("\n— Privacy sanitizers —");
check(
  "sanitizeUrl removes sensitive params, keeps safe ones",
  sanitizeUrl("/account?next=/home&access_token=abc&user=jane") ===
    "/account?next=%2Fhome&user=jane"
);
check("sanitizeUrl strips fragment", sanitizeUrl("/x#secret-anchor") === "/x");
check(
  "scrubPayload redacts password keys",
  scrubPayload({ password: "hunter2", note: "ok" }).password === "[redacted]"
);
check(
  "scrubPayload keeps safe keys",
  scrubPayload({ status: 500, note: "ok" }).status === 500
);

console.log(`\nResult: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
