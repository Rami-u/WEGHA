import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getAttempt, listStudentExams, startAttempt, submitAttempt } from "../../api/assessments";
import { getCourse } from "../../api/courses";
import { reportBrowserEvent } from "../../api/proctoring";
import { Alert, Button, FullPageSpinner, Label, cn } from "../../components/ui";
import { useSession } from "../../context/SessionContext";
import { useApiErrorText } from "../../lib/apiErrorText";
import { ApiError } from "../../lib/apiClient";
import type { Course, ExamAttemptState, StudentExam } from "../../types/api";
import { arDigits } from "./sampleContent";
import { ContentHeader } from "./ContentUI";

/*
  Student exam page, wired to the real attempts API.

  The backend round that added these endpoints starts/submits an attempt, keeps
  the clock, records consent and accepts proctoring signals — it does NOT send
  the questions or grade answers. The page therefore shows the real attempt
  lifecycle and says plainly what the server does not provide yet.
*/

type Phase = "intro" | "attempt" | "result";

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return arDigits(`${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

export function ExamPage() {
  const params = useParams();
  const courseId = Number(params.courseId);
  const examId = Number(params.examId);
  const { slug } = useSession();
  const errorToText = useApiErrorText();

  const [course, setCourse] = useState<Course | null>(null);
  const [exam, setExam] = useState<StudentExam | null>(null);
  const [attempt, setAttempt] = useState<ExamAttemptState | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [consent, setConsent] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const deadline = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const submitting = useRef(false);
  const finishRef = useRef<(auto: boolean) => void>(() => {});

  const load = useCallback(async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const [courseRow, examRows] = await Promise.all([
        getCourse(slug ?? "", courseId),
        listStudentExams(slug ?? ""),
      ]);
      setCourse(courseRow);
      setExam(examRows.find((row) => row.id === examId) ?? null);
    } catch (error) {
      setErrorText(errorToText(error as ApiError, "تعذّر تحميل الاختبار."));
    } finally {
      setLoading(false);
    }
  }, [slug, courseId, examId, errorToText]);

  useEffect(() => {
    void load();
  }, [load]);

  // Countdown for an in-progress attempt. The server is authoritative: its
  // remaining_seconds seeded the deadline, and a late submit is recorded at the
  // deadline rather than at the current time.
  useEffect(() => {
    if (phase !== "attempt" || !attempt || attempt.status !== "in_progress") return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(timer);
        finishRef.current(true);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, attempt]);

  // Browser signal: report a hidden tab while a proctored attempt is running.
  useEffect(() => {
    if (phase !== "attempt" || !attempt || attempt.status !== "in_progress" || !exam?.proctoring_enabled) {
      return;
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      if (hiddenAt.current !== null) {
        const seconds = Math.round((Date.now() - hiddenAt.current) / 1000);
        hiddenAt.current = null;
        void reportBrowserEvent(slug ?? "", attempt.id, "tab_hidden", seconds).catch(() => {
          /* a rejected signal must never interrupt the attempt */
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [phase, attempt, exam?.proctoring_enabled, slug]);

  useEffect(() => {
    if (phase !== "attempt") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  const finish = useCallback(
    async (auto: boolean) => {
      if (!attempt || submitting.current) return;
      submitting.current = true;
      setBusy(true);
      setErrorText(null);
      try {
        const state = await submitAttempt(slug ?? "", attempt.id);
        setAttempt(state);
        setPhase("result");
        setNotice(auto ? "انتهى الوقت، وسُلّمت المحاولة تلقائيًا عند الموعد النهائي." : null);
        await load();
      } catch (error) {
        const apiError = error as ApiError;
        if (apiError.status === 400) {
          // Already finished elsewhere (another tab or an earlier submit).
          try {
            const state = await getAttempt(slug ?? "", attempt.id);
            setAttempt(state);
            setPhase("result");
            setNotice("كانت المحاولة مسلّمة بالفعل.");
          } catch {
            setErrorText(errorToText(apiError, "تعذّر تسليم المحاولة."));
          }
        } else {
          setErrorText(errorToText(apiError, "تعذّر تسليم المحاولة."));
        }
      } finally {
        submitting.current = false;
        setBusy(false);
        setConfirmSubmit(false);
      }
    },
    [attempt, slug, load, errorToText],
  );

  finishRef.current = (auto: boolean) => void finish(auto);

  async function begin() {
    if (!exam) return;
    setBusy(true);
    setErrorText(null);
    setNotice(null);
    try {
      const state = await startAttempt(slug ?? "", exam.id, consent);
      setAttempt(state);
      if (state.status !== "in_progress") {
        setPhase("result");
        setNotice("هذه المحاولة منتهية بالفعل.");
        return;
      }
      deadline.current = Date.now() + state.remaining_seconds * 1000;
      setSecondsLeft(state.remaining_seconds);
      setPhase("attempt");
    } catch (error) {
      setErrorText(errorToText(error as ApiError, "تعذّر بدء المحاولة."));
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    setAttempt(null);
    setNotice(null);
    setErrorText(null);
    setConsent(false);
    setPhase("intro");
    void load();
  }

  if (loading) {
    return <FullPageSpinner />;
  }

  if (!exam) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-bold text-ink">لم يتم العثور على هذا الاختبار</p>
        <p className="mt-2 text-sm text-ink-secondary">
          {errorText ?? "قد لا يكون منشورًا، أو لا يوجد تسجيل نشط لك في دورته."}
        </p>
        <Link to={`/courses/${courseId}/exams`} className="mt-6 inline-block">
          <Button variant="secondary">العودة إلى اختبارات الدورة</Button>
        </Link>
      </div>
    );
  }

  const attemptsLeft = Math.max(0, exam.max_attempts - exam.attempts_used);
  const inProgress = exam.in_progress_attempt_id !== null;

  if (phase === "intro") {
    return (
      <div className="mx-auto max-w-2xl">
        <ContentHeader
          title={exam.title}
          hint={exam.description ?? "اقرأ التعليمات قبل أن تبدأ المحاولة."}
          back={`/courses/${courseId}/exams`}
          backLabel="العودة إلى اختبارات الدورة"
          note={null}
        />

        {errorText && (
          <div className="mb-4">
            <Alert tone="error">{errorText}</Alert>
          </div>
        )}

        <div className="rounded-panel border border-line bg-surface p-6 sm:p-8">
          {course && <p className="text-sm text-ink-muted">{course.title}</p>}
          <div role="heading" aria-level={2} className="mt-2 text-xl font-bold text-ink">
            قبل بدء المحاولة
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatChip value={arDigits(exam.question_count)} label="أسئلة" />
            <StatChip
              value={exam.duration_minutes ? arDigits(exam.duration_minutes) : "—"}
              label="دقائق"
            />
            <StatChip value={arDigits(exam.total_points)} label="نقاط" />
            <StatChip value={`${arDigits(exam.attempts_used)}/${arDigits(exam.max_attempts)}`} label="محاولات" />
          </div>

          <ul className="mt-5 list-inside list-disc space-y-2 text-sm leading-8 text-ink">
            <li>يبدأ المؤقّت على الخادم عند بدء المحاولة، ويُحتسب التسليم المتأخر عند الموعد النهائي.</li>
            <li>{inProgress ? "لديك محاولة جارية — «متابعة» تستأنف المحاولة نفسها ولا تفتح واحدة جديدة." : `المحاولات المتاحة المتبقية: ${arDigits(attemptsLeft)}.`}</li>
            <li>عند انتهاء الوقت تُسلّم المحاولة تلقائيًا.</li>
            {exam.proctoring_enabled && (
              <li>هذا الاختبار بمراقبة: تُسجّل إشارات مثل تبديل التبويب ليراجعها المعلّم، ولا يترتّب عليها حكم تلقائي.</li>
            )}
          </ul>

          <div className="mt-5 rounded-control border border-line bg-soft px-4 py-3 text-sm leading-7 text-ink">
            هذه المرحلة من الـbackend تتيح بدء المحاولة وتسليمها وتسجيل وقتها وإشارات المراقبة، لكنها لا
            ترسل نص الأسئلة للطالب ولا تحفظ إجاباته ولا تُعيد درجته بعد التسليم. لذلك لا تعرض هذه
            الصفحة أسئلة وهمية.
          </div>

          {exam.proctoring_enabled && (
            <div className="mt-5 rounded-control border border-line p-4">
              <Label htmlFor="exam-consent" className="flex items-start gap-3">
                <input
                  id="exam-consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-accent"
                />
                <span className="text-sm leading-7 text-ink">
                  أوافق على تسجيل إشارات المراقبة أثناء المحاولة (مثل تبديل التبويب) ليراجعها المعلّم.
                  التقاط الكاميرا غير مضمّن في هذه الواجهة بعد.
                </span>
              </Label>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              size="lg"
              onClick={() => void begin()}
              disabled={busy || (exam.proctoring_enabled && !consent) || (attemptsLeft === 0 && !inProgress)}
            >
              {busy
                ? "جارٍ الاتصال..."
                : inProgress
                  ? "متابعة المحاولة"
                  : `ابدأ المحاولة ${arDigits(exam.attempts_used + 1)} من ${arDigits(exam.max_attempts)}`}
            </Button>
            <Link to={`/courses/${courseId}/exams`}>
              <Button variant="ghost" size="lg">
                العودة إلى الاختبارات
              </Button>
            </Link>
          </div>

          {attemptsLeft === 0 && !inProgress && (
            <p className="mt-3 text-sm text-ink-muted">استُخدمت كل المحاولات المتاحة لهذا الاختبار.</p>
          )}
        </div>
      </div>
    );
  }

  if (phase === "attempt" && attempt) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-line bg-section px-6 py-5">
          <div>
            <p className="text-sm text-ink">{course?.title ?? "الاختبار"}</p>
            <p className="font-bold text-ink">{exam.title}</p>
            <p className="mt-1 text-xs text-ink-muted">
              المحاولة {arDigits(attempt.attempt_number)} · بدأت {formatTime(attempt.started_at)} · تنتهي{" "}
              {formatTime(attempt.ends_at)}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-bold tabular-nums",
              secondsLeft < 60 ? "bg-err-bg text-err" : "bg-soft text-ink",
            )}
          >
            <span className="me-2">الوقت المتبقّي</span>
            {formatClock(secondsLeft)}
          </span>
        </div>

        {errorText && (
          <div className="mt-4">
            <Alert tone="error">{errorText}</Alert>
          </div>
        )}

        <div className="mt-4 rounded-card border border-line bg-surface p-6">
          <div role="heading" aria-level={2} className="text-lg font-bold text-ink">
            المحاولة جارية على الخادم
          </div>
          <p className="mt-2 text-sm leading-8 text-ink">
            سجّل الخادم بداية المحاولة ويحسب وقتها. لا تُعرض أسئلة هنا لأن واجهة تسليم الأسئلة
            وتصحيحها غير متاحة في هذه المرحلة من الـbackend.
          </p>
          <dl className="mt-4 space-y-2 text-sm text-ink-secondary">
            <div className="flex flex-wrap justify-between gap-2">
              <dt>حالة المحاولة</dt>
              <dd className="font-semibold text-ink">قيد التنفيذ</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt>المراقبة</dt>
              <dd className="font-semibold text-ink">
                {exam.proctoring_enabled ? "مفعّلة — تُسجّل إشارات للمراجعة" : "غير مفعّلة"}
              </dd>
            </div>
            {exam.proctoring_enabled && (
              <div className="flex flex-wrap justify-between gap-2">
                <dt>الموافقة</dt>
                <dd className="font-semibold text-ink">سُجّلت عند بدء المحاولة</dd>
              </div>
            )}
          </dl>
        </div>

        {notice && (
          <div className="mt-4">
            <Alert tone="success">{notice}</Alert>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <Button size="lg" onClick={() => setConfirmSubmit(true)} disabled={busy}>
            {busy ? "جارٍ التسليم..." : "تسليم المحاولة"}
          </Button>
        </div>

        {confirmSubmit && (
          <SubmitExamDialog
            onCancel={() => setConfirmSubmit(false)}
            onConfirm={() => void finish(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <ContentHeader
        title={`نتيجة المحاولة · ${exam.title}`}
        hint="حالة المحاولة كما حفظها الخادم."
        back={`/courses/${courseId}/exams`}
        backLabel="العودة إلى اختبارات الدورة"
        note={null}
      />

      <div className="rounded-card border border-line bg-surface p-8 text-center">
        <div role="heading" aria-level={1} className="text-2xl font-bold text-ink">
          تم تسليم المحاولة
        </div>
        <p className="mt-3 text-sm leading-7 text-ink">
          {notice ?? "سُلّمت المحاولة بنجاح."}
        </p>
        <dl className="mx-auto mt-5 max-w-sm space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-ink-secondary">رقم المحاولة</dt>
            <dd className="font-semibold text-ink">
              {attempt ? arDigits(attempt.attempt_number) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-secondary">وقت التسليم</dt>
            <dd className="font-semibold text-ink">
              {attempt ? formatTime(attempt.submitted_at ?? attempt.ends_at) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-secondary">الحالة</dt>
            <dd className="font-semibold text-ink">
              {attempt?.status === "graded" ? "مُصحّحة" : "مسلّمة"}
            </dd>
          </div>
        </dl>
        <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-ink-secondary">
          لا تُعيد واجهة الـAPI درجة المحاولة أو تصحيح الإجابات في هذه المرحلة، لذلك لا تعرض الصفحة
          نتيجة رقمية. ستظهر النتيجة هنا عندما يضيف الـbackend التصحيح.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to={`/courses/${courseId}/exams`}>
            <Button variant="secondary">اختبارات الدورة</Button>
          </Link>
          {attemptsLeft > 0 && <Button onClick={retry}>محاولة جديدة</Button>}
        </div>
      </div>
    </div>
  );
}

function SubmitExamDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="exam-submit-title"
      className="m-auto max-h-dvh w-full max-w-md overflow-auto rounded-panel border border-line bg-surface p-6 text-ink shadow-elevated backdrop:bg-panel/50"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div id="exam-submit-title" role="heading" aria-level={2} className="text-xl font-bold">
        تسليم المحاولة الآن؟
      </div>
      <div className="mt-4 text-sm leading-8">
        بعد التسليم تُغلق المحاولة على الخادم وتنتهي جلسة المراقبة، ولا يمكن استئنافها.
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant="secondary" size="lg" autoFocus onClick={onCancel}>
          البقاء في المحاولة
        </Button>
        <Button size="lg" onClick={onConfirm}>
          تأكيد التسليم
        </Button>
      </div>
    </dialog>
  );
}

function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-card bg-soft px-4 py-3">
      <p className="text-lg font-extrabold tabular-nums text-ink">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}
