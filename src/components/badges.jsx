import {
  AlertTriangle,
  CircleDot,
  FileText,
  MousePointerClick,
  Navigation,
  Terminal,
  WifiOff,
  XCircle,
} from "lucide-react";

export const EVENT_META = {
  session_start: { label: "Session start", icon: CircleDot, cls: "text-faint" },
  session_end: { label: "Session end", icon: CircleDot, cls: "text-faint" },
  click: { label: "Click", icon: MousePointerClick, cls: "text-accent" },
  navigation: { label: "Navigation", icon: Navigation, cls: "text-accent" },
  console_error: { label: "Console error", icon: Terminal, cls: "text-warn" },
  unhandled_error: {
    label: "Uncaught error",
    icon: AlertTriangle,
    cls: "text-danger",
  },
  network_error: { label: "Network error", icon: WifiOff, cls: "text-danger" },
  http_error: { label: "HTTP error", icon: XCircle, cls: "text-high" },
  custom_event: { label: "Custom", icon: FileText, cls: "text-mute" },
};

export const ERROR_TYPES = [
  "console_error",
  "unhandled_error",
  "network_error",
  "http_error",
];

export function EventIcon({ type, className = "" }) {
  const meta = EVENT_META[type] || EVENT_META.custom_event;
  const Icon = meta.icon;
  return <Icon className={`h-3.5 w-3.5 ${meta.cls} ${className}`} />;
}

const SEVERITY_STYLES = {
  low: "border-line text-mute bg-raised",
  medium: "border-warn/40 text-warn bg-warn/10",
  high: "border-high/40 text-high bg-high/10",
  critical: "border-crit/50 text-crit bg-crit/10",
};

export function SeverityBadge({ severity }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide ${
        SEVERITY_STYLES[severity] || SEVERITY_STYLES.low
      }`}
    >
      {severity}
    </span>
  );
}

const STATUS_STYLES = {
  open: "border-accent/40 text-accent bg-accent/10",
  acknowledged: "border-warn/40 text-warn bg-warn/10",
  resolved: "border-ok/40 text-ok bg-ok/10",
};

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] ${
        STATUS_STYLES[status] || STATUS_STYLES.open
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function EnvChip({ environment }) {
  const styles = {
    development: "text-accent border-accent/30",
    staging: "text-warn border-warn/30",
    production: "text-danger border-danger/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded border bg-surface px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
        styles[environment] || "text-mute border-line"
      }`}
    >
      {environment}
    </span>
  );
}

export function AnomalyChip({ score }) {
  if (score == null) return <span className="text-faint">—</span>;
  const cls =
    score < 20
      ? "text-mute border-line"
      : score < 45
        ? "text-warn border-warn/40"
        : score < 70
          ? "text-high border-high/40"
          : "text-crit border-crit/50";
  return (
    <span
      title="Deterministic anomaly score (triage heuristic, not a fault prediction)"
      className={`inline-flex items-center rounded border bg-surface px-1.5 py-0.5 font-mono text-[11px] ${cls}`}
    >
      {score}
    </span>
  );
}
