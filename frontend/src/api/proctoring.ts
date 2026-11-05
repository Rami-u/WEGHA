import { apiRequest } from "../lib/apiClient";
import { fetchAllPages } from "./pagination";
import type {
  ProctoringEvent,
  ProctoringEventType,
  ProctoringReviewStatus,
  ProctoringSeverity,
} from "../types/api";

/**
 * Proctoring endpoints from apps/proctoring (Stage 9).
 * Events are signals for the teacher to review, never automatic verdicts.
 */

const prefix = (slug: string): string => `/workspaces/${encodeURIComponent(slug)}`;

export interface EventFilters {
  review_status?: ProctoringReviewStatus;
  event_type?: ProctoringEventType;
  severity?: ProctoringSeverity;
}

/** GET /attempts/{id}/proctoring/events/ — teacher only, scoped to the workspace. */
export function listAttemptEvents(
  slug: string,
  attemptId: number,
  filters: EventFilters = {},
): Promise<ProctoringEvent[]> {
  const query = new URLSearchParams();
  if (filters.review_status) query.set("review_status", filters.review_status);
  if (filters.event_type) query.set("event_type", filters.event_type);
  if (filters.severity) query.set("severity", filters.severity);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return fetchAllPages<ProctoringEvent>(
    `${prefix(slug)}/attempts/${attemptId}/proctoring/events/${suffix}`,
  );
}

/** GET /proctoring/events/{id}/ */
export function getProctoringEvent(slug: string, eventId: number): Promise<ProctoringEvent> {
  return apiRequest(`${prefix(slug)}/proctoring/events/${eventId}/`);
}

/** POST /proctoring/events/{id}/review/ — 409 when the event was already reviewed. */
export function reviewProctoringEvent(
  slug: string,
  eventId: number,
  reviewStatus: Exclude<ProctoringReviewStatus, "pending">,
): Promise<ProctoringEvent> {
  return apiRequest(`${prefix(slug)}/proctoring/events/${eventId}/review/`, {
    method: "POST",
    json: { review_status: reviewStatus },
  });
}

/**
 * Evidence URLs from the API are already absolute paths under /api/v1, so they
 * can be used directly as an <img> source; the view authorizes the session.
 */
export function proctoringEvidenceUrl(fileUrl: string): string {
  return fileUrl;
}

/** POST /attempts/{id}/frames/ — one JPEG/PNG frame, multipart field `image`. */
export function uploadProctoringFrame(
  slug: string,
  attemptId: number,
  image: Blob,
  fileName = "frame.jpg",
): Promise<{ ok: boolean }> {
  const formData = new FormData();
  formData.append("image", image, fileName);
  return apiRequest(`${prefix(slug)}/attempts/${attemptId}/frames/`, {
    method: "POST",
    formData,
  });
}

/**
 * POST /attempts/{id}/browser-events/ — only `tab_hidden` is accepted and it is
 * stored as the `tab_switch` event type.
 */
export function reportBrowserEvent(
  slug: string,
  attemptId: number,
  type: "tab_hidden",
  durationSeconds?: number,
): Promise<{ ok: boolean }> {
  return apiRequest(`${prefix(slug)}/attempts/${attemptId}/browser-events/`, {
    method: "POST",
    json: { type, ...(durationSeconds !== undefined ? { duration_seconds: durationSeconds } : {}) },
  });
}
