export type AgentEventType =
  | "scan_started"
  | "scan_completed"
  | "scan_symbol_done"
  | "health_alert"
  | "health_ok"
  | "training_triggered"
  | "training_completed"
  | "chat_query"
  | "anomaly_detected"
  | "scheduler_tick";

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  timestamp: string;
  message: string;
  data?: Record<string, unknown>;
}

const MAX_EVENTS = 200;
const _events: AgentEvent[] = [];
let _seq = 0;

export function logAgentEvent(
  type: AgentEventType,
  message: string,
  data?: Record<string, unknown>,
): AgentEvent {
  const event: AgentEvent = {
    id: `evt-${Date.now()}-${++_seq}`,
    type,
    timestamp: new Date().toISOString(),
    message,
    data,
  };
  _events.unshift(event);
  if (_events.length > MAX_EVENTS) _events.splice(MAX_EVENTS);
  return event;
}

export function getAgentEvents(limit = 50): AgentEvent[] {
  return _events.slice(0, limit);
}

export function clearAgentEvents(): void {
  _events.length = 0;
}
