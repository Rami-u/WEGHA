import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { getAttempt } from "../../../api/assessments";
import { listAttemptEvents, reviewProctoringEvent } from "../../../api/proctoring";
import { Alert, Button, Card, EmptyState, Input, Label, Select, cn } from "../../../components/ui";
import { useSession } from "../../../context/SessionContext";
import { useApiErrorText } from "../../../lib/apiErrorText";
import { ApiError } from "../../../lib/apiClient";
import type {
  ExamAttemptState,
  ProctoringEvent,
  ProctoringEventType,
  ProctoringReviewStatus,
  ProctoringSeverity,
} from "../../../types/api";

/*
  Teacher proctoring review.

  Events are signals, never verdicts: the teacher dismisses or marks a violation.
  The backend has no endpoint that lists attempts yet, so the page needs the
  attempt id the student's attempt was created with.
*/

const EVENT_TYPE_LABEL: Record<ProctoringEventType, string> = {
  face_missing: "غياب الوجه",
  multiple_faces: "أكثر من وجه",
  looking_away: "النظر بعيدًا",
  phone_detected: "هاتف مكتشف",
  tab_switch: "تبديل التبويب",
};

const SEVERITY_LABEL: Record<ProctoringSeverity, string> = {
  info: "معلومة",
  warning: "تنبيه",
  high: "مرتفع",
};

const REVIEW_LABEL: Record<ProctoringReviewStatus, string> = {
  pending: "بانتظار المراجعة",
  dismissed: "مُستبعد",
  violation: "مخالفة",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ar-EG", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

export function ProctoringReviewPage() {
  const { slug } = useSession();
  const errorToText = useApiErrorText();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialAttempt = Number(searchParams.get("attempt"));
  const [attemptInput, setAttemptInput] = useState(
    Number.isInteger(initialAttempt) && initialAttempt > 0 ? String(initialAttempt) : "",
  );
  const [attemptId, setAttemptId] = useState<number | null>(
    Number.isInteger(initialAttempt) && initialAttempt > 0 ? initialAttempt : null,
  );
  const [attempt, setAttempt] = useState<ExamAttemptState | null>(null);

  const [events, setEvents] = useState<ProctoringEvent[]>([]);
  const [reviewFilter, setReviewFilter] = useState<ProctoringReviewStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<ProctoringEventType | "">("");
  const [severityFilter, setSeverityFilter] = useState<ProctoringSeverity | "">("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (attemptId === null) return;
    setLoading(true);
    setErrorText(null);
    try {
      const rows = await listAttemptEvents(slug ?? "", attemptId, {
        review_status: reviewFilter || undefined,
        event_type: typeFilter || undefined,
        severity: severityFilter || undefined,
      });
      setEvents(rows);
    } catch (error) {
      setEvents([]);
      setErrorText(errorToText(error as ApiError, "تعذّر تحميل إشارات المراقبة."));
    } finally {
      setLoading(false);
    }
  }, [attemptId, slug, reviewFilter, typeFilter, severityFilter, errorToText]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    let cancelled = false;
    if (attemptId === null) {
      setAttempt(null);
      return;
    }
    (async () => {
      try {
        const loaded = await getAttempt(slug ?? "", attemptId);
        if (!cancelled) setAttempt(loaded);
      } catch {
        if (!cancelled) setAttempt(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId, slug]);

  function openAttempt() {
    const parsed = Number(attemptInput);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setErrorText("أدخل رقم محاولة صحيحًا.");
      return;
    }
    setAttemptId(parsed);
    setSearchParams({ attempt: String(parsed) });
  }

  async function review(event: ProctoringEvent, status: "dismissed" | "violation") {
    setBusyId(event.id);
    setErrorText(null);
    try {
      const updated = await reviewProctoringEvent(slug ?? "", event.id, status);
      setEvents((current) => current.map((row) => (row.id === updated.id ? updated : row)));
    } catch (error) {
      setErrorText(errorToText(error as ApiError, "تعذّر حفظ المراجعة."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link
          to="/teacher/courses"
          className="mb-4 inline-flex min-h-11 items-center text-sm font-bold text-accent hover:underline"
        >
          العودة إلى إدارة الدورات
        </Link>
        <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">مراجعة إشارات المراقبة</h1>
        <p className="mt-2 text-sm leading-7 text-ink">
          كل صف إشارة سجّلها النظام لمحاولة طالب. الإشارة ليست حكمًا: أنت من يستبعدها أو يسجّلها
          كمخالفة.
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Label htmlFor="attempt-id">رقم المحاولة</Label>
            <Input
              id="attempt-id"
              type="number"
              min={1}
              inputMode="numeric"
              value={attemptInput}
              onChange={(event) => setAttemptInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") openAttempt();
              }}
              placeholder="مثال: 12"
              className="min-h-11"
            />
          </div>
          <Button className="min-h-11" onClick={openAttempt}>
            تحميل الإشارات
          </Button>
        </div>
        <p className="mt-2 text-xs leading-6 text-ink-muted">
          لا يوفّر الـbackend قائمة محاولات للمعلّم بعد، لذلك تُحمّل الإشارات برقم المحاولة.
        </p>
        {attempt && (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-control bg-soft px-4 py-3 text-sm text-ink">
            <span>
              الطالب: <strong className="text-ink">#{attempt.id}</strong>
            </span>
            <span>
              الحالة: <strong className="text-ink">{attempt.status === "in_progress" ? "قيد التنفيذ" : "منتهية"}</strong>
            </span>
            <span>
              بدأت: <strong className="text-ink">{formatDateTime(attempt.started_at)}</strong>
            </span>
            <span>
              تنتهي: <strong className="text-ink">{formatDateTime(attempt.ends_at)}</strong>
            </span>
          </div>
        )}
      </Card>

      {attemptId !== null && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="review-filter">حالة المراجعة</Label>
            <Select
              id="review-filter"
              value={reviewFilter}
              onChange={(event) => setReviewFilter(event.target.value as ProctoringReviewStatus | "")}
              className="min-h-11"
            >
              <option value="">الكل</option>
              {Object.entries(REVIEW_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="type-filter">نوع الإشارة</Label>
            <Select
              id="type-filter"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as ProctoringEventType | "")}
              className="min-h-11"
            >
              <option value="">الكل</option>
              {Object.entries(EVENT_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="severity-filter">الخطورة</Label>
            <Select
              id="severity-filter"
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as ProctoringSeverity | "")}
              className="min-h-11"
            >
              <option value="">الكل</option>
              {Object.entries(SEVERITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {errorText && (
        <div className="mt-4">
          <Alert tone="error">{errorText}</Alert>
        </div>
      )}

      {attemptId !== null && loading && (
        <p className="mt-6 text-sm text-ink-muted">جارٍ تحميل الإشارات...</p>
      )}

      {attemptId !== null && !loading && events.length === 0 && !errorText && (
        <div className="mt-6">
          <EmptyState
            title="لا إشارات مطابقة"
            hint="قد تكون المحاولة بلا إشارات، أو أن الفلتر الحالي يخفيها."
          />
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {events.map((event) => {
          const details = event.details ?? {};
          const duration = details.duration_seconds;
          const source = details.source;
          return (
            <li key={event.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink">{EVENT_TYPE_LABEL[event.event_type]}</span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          event.severity === "high"
                            ? "bg-err-bg text-err"
                            : event.severity === "warning"
                              ? "bg-warn-bg text-warn"
                              : "bg-soft text-ink-secondary",
                        )}
                      >
                        {SEVERITY_LABEL[event.severity]}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          event.review_status === "violation"
                            ? "bg-err-bg text-err"
                            : event.review_status === "dismissed"
                              ? "bg-success-bg text-success"
                              : "bg-warn-bg text-warn",
                        )}
                      >
                        {REVIEW_LABEL[event.review_status]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ink-secondary">{formatDateTime(event.occurred_at)}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {typeof source === "string" ? `المصدر: ${source}` : ""}
                      {typeof duration === "number" ? ` · المدة: ${duration} ثانية` : ""}
                      {event.reviewed_at ? ` · روجعت في ${formatDateTime(event.reviewed_at)}` : ""}
                    </p>

                    {event.evidence.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {event.evidence.map((evidence) => (
                          <a
                            key={evidence.id}
                            href={evidence.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-control border border-line"
                          >
                            {evidence.mime_type?.startsWith("image/") ? (
                              <img
                                src={evidence.file_url}
                                alt={`لقطة ${event.id}`}
                                className="h-24 w-32 object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="block px-3 py-2 text-xs text-accent">
                                فتح الدليل ({evidence.evidence_type})
                              </span>
                            )}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {event.review_status === "pending" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="min-h-11"
                        disabled={busyId === event.id}
                        onClick={() => void review(event, "dismissed")}
                      >
                        استبعاد
                      </Button>
                      <Button
                        variant="secondary"
                        className="min-h-11"
                        disabled={busyId === event.id}
                        onClick={() => void review(event, "violation")}
                      >
                        تسجيل مخالفة
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm text-ink-muted">روجعت — لا يمكن تغيير القرار.</span>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
