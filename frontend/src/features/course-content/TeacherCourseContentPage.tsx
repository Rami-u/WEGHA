import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  archiveExam,
  createExam,
  createQuestion,
  createTopic,
  getExamQuestions,
  listQuestions,
  listTeacherExams,
  listTopics,
  publishExam,
  questionAction,
  replaceExamQuestions,
  updateExam,
  updateQuestion,
  updateTopic,
} from "../../api/assessments";
import { getCourse } from "../../api/courses";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Select,
  Textarea,
  cn,
} from "../../components/ui";
import { useSession } from "../../context/SessionContext";
import { useApiErrorText, type ApiErrorTextFn } from "../../lib/apiErrorText";
import { ApiError } from "../../lib/apiClient";
import type {
  Course,
  Exam,
  ExamQuestionRow,
  McqOption,
  Question,
  QuestionAnswer,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
  Topic,
} from "../../types/api";
import { arDigits } from "./sampleContent";
import { ContentHeader, ContentStats, contentLink } from "./ContentUI";

/*
  Teacher content manager.

  Exams, the question bank and topics are real API data (apps/assessments,
  Stage 8/9). Lessons and assets still have no endpoints in this backend round,
  so the page says so instead of pretending to manage them.
*/

type Tab = "exams" | "questions" | "topics";

const EXAM_STATUS_LABEL: Record<Exam["status"], string> = {
  draft: "مسوّدة",
  published: "منشور",
  archived: "مؤرشف",
};

const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  draft: "مسوّدة",
  approved: "معتمد",
  rejected: "مرفوض",
  archived: "مؤرشف",
};

const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  mcq: "اختيار من متعدد",
  true_false: "صح / خطأ",
  short: "إجابة قصيرة",
  essay: "مقالي",
};

const DIFFICULTY_LABEL: Record<QuestionDifficulty, string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

const OPTION_IDS = ["a", "b", "c", "d", "e", "f"] as const;

const badge = "rounded-full px-2.5 py-0.5 text-xs font-semibold";

function describeError(error: unknown, fallback: string, errorToText: ApiErrorTextFn): string {
  if (error instanceof ApiError) {
    const fieldEntry = Object.entries(error.fieldErrors)[0];
    if (fieldEntry) return `${fieldEntry[0]}: ${fieldEntry[1][0]}`;
    return errorToText(error, fallback);
  }
  return fallback;
}

interface ExamFormState {
  id: number | null;
  title: string;
  description: string;
  durationMinutes: string;
  passingScore: string;
  maxAttempts: string;
  proctoringEnabled: boolean;
}

const emptyExamForm = (): ExamFormState => ({
  id: null,
  title: "",
  description: "",
  durationMinutes: "30",
  passingScore: "60",
  maxAttempts: "1",
  proctoringEnabled: false,
});

interface QuestionFormState {
  id: number | null;
  type: QuestionType;
  stem: string;
  points: string;
  difficulty: QuestionDifficulty;
  explanation: string;
  topicIds: number[];
  options: McqOption[];
  correctOptionId: string;
  trueFalse: boolean;
  shortAnswers: string;
  essayAnswer: string;
}

const defaultOptions = (): McqOption[] =>
  OPTION_IDS.slice(0, 4).map((id) => ({ id, text: "" }));

const emptyQuestionForm = (): QuestionFormState => ({
  id: null,
  type: "mcq",
  stem: "",
  points: "1.00",
  difficulty: "medium",
  explanation: "",
  topicIds: [],
  options: defaultOptions(),
  correctOptionId: "a",
  trueFalse: true,
  shortAnswers: "",
  essayAnswer: "",
});

function questionToForm(question: Question): QuestionFormState {
  const isAnswerString = typeof question.correct_answer === "string";
  return {
    id: question.id,
    type: question.question_type,
    stem: question.stem,
    points: question.points,
    difficulty: question.difficulty,
    explanation: question.explanation ?? "",
    topicIds: question.topics.map((topic) => topic.id),
    options: question.options?.length ? question.options : defaultOptions(),
    correctOptionId:
      question.question_type === "mcq" && isAnswerString ? String(question.correct_answer) : "a",
    trueFalse: question.question_type === "true_false" ? question.correct_answer === true : true,
    shortAnswers: Array.isArray(question.correct_answer) ? question.correct_answer.join("\n") : "",
    essayAnswer:
      question.question_type === "essay" && isAnswerString ? String(question.correct_answer) : "",
  };
}

function buildQuestionPayload(form: QuestionFormState, courseId: number) {
  let options: McqOption[] | null = null;
  let correctAnswer: QuestionAnswer = null;

  if (form.type === "mcq") {
    options = form.options
      .map((option) => ({ id: option.id, text: option.text.trim() }))
      .filter((option) => option.text.length > 0);
    correctAnswer = form.correctOptionId;
  } else if (form.type === "true_false") {
    correctAnswer = form.trueFalse;
  } else if (form.type === "short") {
    correctAnswer = form.shortAnswers
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } else {
    correctAnswer = form.essayAnswer.trim();
  }

  return {
    stem: form.stem.trim(),
    options,
    correct_answer: correctAnswer,
    explanation: form.explanation.trim() || null,
    difficulty: form.difficulty,
    points: form.points,
    course: courseId,
    topic_ids: form.topicIds,
  };
}

export function TeacherCourseContentPage() {
  const params = useParams();
  const courseId = Number(params.courseId);
  const { slug } = useSession();
  const errorToText = useApiErrorText();

  const [course, setCourse] = useState<Course | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("exams");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoadError(null);
    try {
      const [courseRow, topicRows, questionRows, examRows] = await Promise.all([
        getCourse(slug ?? "", courseId),
        listTopics(slug ?? "", courseId),
        listQuestions(slug ?? "", { course: courseId }),
        listTeacherExams(slug ?? ""),
      ]);
      setCourse(courseRow);
      setTopics(topicRows);
      setQuestions(questionRows);
      setExams(examRows.filter((exam) => exam.course === courseId));
    } catch (error) {
      setLoadError(describeError(error, "تعذّر تحميل محتوى الدورة.", errorToText));
    } finally {
      setLoading(false);
    }
  }, [slug, courseId, errorToText]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const publishedExams = exams.filter((exam) => exam.status === "published").length;

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-sm text-ink-muted">جارٍ تحميل محتوى الدورة...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center">
        <p className="font-bold text-ink">لم يتم العثور على الدورة</p>
        {loadError && <p className="mt-2 text-sm text-ink-secondary">{loadError}</p>}
        <Link to="/teacher/courses" className="mt-6 inline-block">
          <Button variant="secondary">العودة إلى إدارة الدورات</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <ContentHeader
        title={`محتوى الدورة · ${course.title}`}
        hint="أدر الاختبارات وبنك الأسئلة والموضوعات، ثم انشر ما هو جاهز."
        back="/teacher/courses"
        backLabel="العودة إلى إدارة الدورات"
        note={null}
      />

      <ContentStats
        items={[
          [arDigits(exams.length), "اختبارات"],
          [arDigits(publishedExams), "اختبارات منشورة"],
          [arDigits(questions.length), "أسئلة"],
          [arDigits(topics.length), "موضوعات"],
        ]}
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <Link to={`/courses/${courseId}`} className={contentLink}>
          صفحة الدورة
        </Link>
        <Link to="/teacher/proctoring" className={contentLink}>
          مراجعة إشارات المراقبة
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="أقسام المحتوى">
        {(
          [
            { value: "exams", label: "الاختبارات" },
            { value: "questions", label: "بنك الأسئلة" },
            { value: "topics", label: "الموضوعات" },
          ] as const
        ).map((item) => (
          <Button
            key={item.value}
            variant={tab === item.value ? "primary" : "secondary"}
            role="tab"
            aria-selected={tab === item.value}
            className="min-h-11"
            onClick={() => {
              setTab(item.value);
              setActionError(null);
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {actionError && (
        <div className="mb-4">
          <Alert tone="error">{actionError}</Alert>
        </div>
      )}

      {tab === "exams" && (
        <ExamsTab
          slug={slug ?? ""}
          courseId={courseId}
          exams={exams}
          questions={questions}
          busy={busy}
          setBusy={setBusy}
          setActionError={setActionError}
          errorToText={errorToText}
          reload={loadAll}
        />
      )}

      {tab === "questions" && (
        <QuestionsTab
          slug={slug ?? ""}
          courseId={courseId}
          questions={questions}
          topics={topics}
          busy={busy}
          setBusy={setBusy}
          setActionError={setActionError}
          errorToText={errorToText}
          reload={loadAll}
        />
      )}

      {tab === "topics" && (
        <TopicsTab
          slug={slug ?? ""}
          courseId={courseId}
          topics={topics}
          busy={busy}
          setBusy={setBusy}
          setActionError={setActionError}
          errorToText={errorToText}
          reload={loadAll}
        />
      )}

      <div className="mt-8 rounded-card border border-dashed border-line p-4 text-sm leading-7 text-ink">
        الدروس وملفات الدروس لا تملك نقاط وصول في الـAPI بعد، لذلك لا تظهر أدوات تحرير لها هنا. تُدار
        الدروس والملفات حاليًا من لوحة إدارة Django، وستُضاف واجهتها مع دعم الـbackend لها.
      </div>
    </div>
  );
}

/* ---------- Exams ---------- */

interface TabProps {
  slug: string;
  courseId: number;
  busy: boolean;
  setBusy: (value: boolean) => void;
  setActionError: (value: string | null) => void;
  errorToText: ApiErrorTextFn;
  reload: () => Promise<void>;
}

function ExamsTab({
  slug,
  courseId,
  exams,
  questions,
  busy,
  setBusy,
  setActionError,
  errorToText,
  reload,
}: TabProps & { exams: Exam[]; questions: Question[] }) {
  const [form, setForm] = useState<ExamFormState | null>(null);
  const [questionsFor, setQuestionsFor] = useState<Exam | null>(null);

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await reload();
    } catch (error) {
      setActionError(describeError(error, fallback, errorToText));
    } finally {
      setBusy(false);
    }
  }

  function startCreate() {
    setQuestionsFor(null);
    setForm(emptyExamForm());
  }

  function startEdit(exam: Exam) {
    setQuestionsFor(null);
    setForm({
      id: exam.id,
      title: exam.title,
      description: exam.description ?? "",
      durationMinutes: exam.duration_minutes ? String(exam.duration_minutes) : "",
      passingScore: exam.passing_score ?? "",
      maxAttempts: String(exam.max_attempts),
      proctoringEnabled: exam.proctoring_enabled,
    });
  }

  async function saveExam() {
    if (!form) return;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      duration_minutes: form.durationMinutes ? Number(form.durationMinutes) : null,
      passing_score: form.passingScore.trim() ? form.passingScore.trim() : null,
      max_attempts: Number(form.maxAttempts || "1"),
      proctoring_enabled: form.proctoringEnabled,
    };
    await run(async () => {
      if (form.id === null) {
        await createExam(slug, courseId, payload);
      } else {
        await updateExam(slug, form.id, payload);
      }
      setForm(null);
    }, "تعذّر حفظ الاختبار.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-ink">
          الاختبار يُنشأ كمسوّدة. أضف أسئلة معتمدة، ثم انشره ليظهر للطلاب المسجّلين.
        </p>
        <Button className="min-h-11" onClick={startCreate} disabled={busy}>
          اختبار جديد
        </Button>
      </div>

      {form && (
        <Card>
          <div role="heading" aria-level={2} className="text-lg font-bold text-ink">
            {form.id === null ? "اختبار جديد" : "تعديل الاختبار"}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="exam-title">العنوان</Label>
              <Input
                id="exam-title"
                value={form.title}
                maxLength={200}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="exam-description">الوصف</Label>
              <Textarea
                id="exam-description"
                rows={3}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="exam-duration">المدة بالدقائق</Label>
              <Input
                id="exam-duration"
                type="number"
                min={1}
                value={form.durationMinutes}
                onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })}
              />
              <p className="mt-1 text-xs text-ink-muted">اتركه فارغًا للمدة الافتراضية (١٨٠ دقيقة).</p>
            </div>
            <div>
              <Label htmlFor="exam-passing">درجة الاجتياز (من ١٠٠)</Label>
              <Input
                id="exam-passing"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.passingScore}
                onChange={(event) => setForm({ ...form, passingScore: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="exam-attempts">عدد المحاولات</Label>
              <Input
                id="exam-attempts"
                type="number"
                min={1}
                value={form.maxAttempts}
                onChange={(event) => setForm({ ...form, maxAttempts: event.target.value })}
              />
            </div>
            <div className="flex items-end pb-1">
              <Label htmlFor="exam-proctoring" className="flex min-h-11 w-full items-center gap-3">
                <input
                  id="exam-proctoring"
                  type="checkbox"
                  checked={form.proctoringEnabled}
                  onChange={(event) => setForm({ ...form, proctoringEnabled: event.target.checked })}
                  className="h-5 w-5 shrink-0 accent-accent"
                />
                <span>تفعيل المراقبة (يتطلب موافقة الطالب قبل البدء)</span>
              </Label>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => void saveExam()} disabled={busy || !form.title.trim()}>
              {busy ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
            <Button variant="ghost" onClick={() => setForm(null)} disabled={busy}>
              إلغاء
            </Button>
          </div>
        </Card>
      )}

      {exams.length === 0 ? (
        <EmptyState title="لا توجد اختبارات لهذه الدورة بعد" hint="أنشئ اختبارًا ثم أضف إليه أسئلة معتمدة." />
      ) : (
        <ul className="space-y-3">
          {exams.map((exam) => (
            <li key={exam.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink">{exam.title}</span>
                      <span
                        className={cn(
                          badge,
                          exam.status === "published"
                            ? "bg-success-bg text-success"
                            : exam.status === "archived"
                              ? "bg-soft text-ink-muted"
                              : "bg-warn-bg text-warn",
                        )}
                      >
                        {EXAM_STATUS_LABEL[exam.status]}
                      </span>
                      {exam.proctoring_enabled && (
                        <span className={cn(badge, "bg-accent-soft text-accent")}>بمراقبة</span>
                      )}
                    </div>
                    {exam.description && (
                      <p className="mt-2 text-sm leading-7 text-ink-secondary">{exam.description}</p>
                    )}
                    <p className="mt-2 text-sm text-ink-secondary">
                      {arDigits(exam.question_count)} أسئلة · {arDigits(exam.total_points)} نقطة ·{" "}
                      {exam.duration_minutes ? `${arDigits(exam.duration_minutes)} دقيقة` : "المدة الافتراضية"} ·{" "}
                      {arDigits(exam.max_attempts)} محاولات
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="min-h-11"
                      onClick={() => {
                        setForm(null);
                        setQuestionsFor(questionsFor?.id === exam.id ? null : exam);
                      }}
                    >
                      الأسئلة
                    </Button>
                    <Button variant="secondary" className="min-h-11" onClick={() => startEdit(exam)}>
                      تعديل
                    </Button>
                    {exam.status === "draft" && (
                      <Button
                        className="min-h-11"
                        disabled={busy}
                        onClick={() => void run(() => publishExam(slug, exam.id), "تعذّر نشر الاختبار.")}
                      >
                        نشر
                      </Button>
                    )}
                    {exam.status !== "archived" && (
                      <Button
                        variant="ghost"
                        className="min-h-11"
                        disabled={busy}
                        onClick={() => void run(() => archiveExam(slug, exam.id), "تعذّر أرشفة الاختبار.")}
                      >
                        أرشفة
                      </Button>
                    )}
                    {exam.status === "published" && (
                      <Link to={`/courses/${courseId}/exams/${exam.id}`} className={contentLink}>
                        معاينة كطالب
                      </Link>
                    )}
                  </div>
                </div>
              </Card>

              {questionsFor?.id === exam.id && (
                <ExamQuestionsPanel
                  slug={slug}
                  exam={exam}
                  questions={questions}
                  errorToText={errorToText}
                  onError={setActionError}
                  onSaved={reload}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExamQuestionsPanel({
  slug,
  exam,
  questions,
  errorToText,
  onError,
  onSaved,
}: {
  slug: string;
  exam: Exam;
  questions: Question[];
  errorToText: ApiErrorTextFn;
  onError: (value: string | null) => void;
  onSaved: () => Promise<void>;
}) {
  const [rows, setRows] = useState<ExamQuestionRow[] | null>(null);
  const [draft, setDraft] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getExamQuestions(slug, exam.id);
        if (cancelled) return;
        setRows(loaded);
        setDraft(loaded.map((row) => row.question_id));
      } catch (error) {
        if (!cancelled) onError(describeError(error, "تعذّر تحميل أسئلة الاختبار.", errorToText));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, exam.id, errorToText, onError]);

  const approved = useMemo(() => questions.filter((question) => question.status === "approved"), [questions]);
  const byId = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions]);
  const candidates = approved.filter((question) => !draft.includes(question.id));

  function move(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setBusy(true);
    onError(null);
    try {
      const updated = await replaceExamQuestions(
        slug,
        exam.id,
        draft.map((questionId) => ({ question_id: questionId })),
      );
      setRows(updated);
      setDraft(updated.map((row) => row.question_id));
      await onSaved();
    } catch (error) {
      onError(describeError(error, "تعذّر حفظ أسئلة الاختبار.", errorToText));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-card border border-line bg-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-ink">أسئلة الاختبار بالترتيب</p>
        <span className="text-xs text-ink-muted">
          {rows === null ? "جارٍ التحميل..." : `${arDigits(draft.length)} سؤالًا`}
        </span>
      </div>

      {draft.length === 0 ? (
        <p className="mt-3 text-sm text-ink-secondary">لا أسئلة بعد. أضف من بنك الأسئلة أدناه.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {draft.map((questionId, index) => {
            const question = byId.get(questionId);
            return (
              <li
                key={questionId}
                className="flex flex-wrap items-center gap-2 rounded-control bg-surface px-3 py-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                  {arDigits(index + 1)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {question?.stem ?? `سؤال #${questionId}`}
                </span>
                <span className="text-xs text-ink-muted">
                  {question ? QUESTION_TYPE_LABEL[question.question_type] : ""}
                </span>
                <Button
                  variant="ghost"
                  className="min-h-9 px-2 text-xs"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="تحريك لأعلى"
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-9 px-2 text-xs"
                  onClick={() => move(index, 1)}
                  disabled={index === draft.length - 1}
                  aria-label="تحريك لأسفل"
                >
                  ↓
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-9 px-2 text-xs"
                  onClick={() => setDraft((current) => current.filter((id) => id !== questionId))}
                  aria-label="إزالة من الاختبار"
                >
                  إزالة
                </Button>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-4">
        <p className="text-sm font-semibold text-ink">إضافة من بنك الأسئلة المعتمدة</p>
        {candidates.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            لا أسئلة معتمدة متاحة. اعتمد أسئلة من تبويب «بنك الأسئلة» أولًا.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {candidates.map((question) => (
              <li key={question.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-ink-secondary">{question.stem}</span>
                <Button
                  variant="secondary"
                  className="min-h-9 px-3 text-xs"
                  onClick={() => setDraft((current) => [...current, question.id])}
                >
                  إضافة
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? "جارٍ الحفظ..." : "حفظ ترتيب الأسئلة"}
        </Button>
        <span className="text-xs text-ink-muted">
          لا يمكن تغيير القائمة إذا كان الاختبار منشورًا وله محاولات.
        </span>
      </div>
    </div>
  );
}

/* ---------- Questions ---------- */

function QuestionsTab({
  slug,
  courseId,
  questions,
  topics,
  busy,
  setBusy,
  setActionError,
  errorToText,
  reload,
}: TabProps & { questions: Question[]; topics: Topic[] }) {
  const [form, setForm] = useState<QuestionFormState | null>(null);
  const [statusFilter, setStatusFilter] = useState<QuestionStatus | "">("");
  const [search, setSearch] = useState("");

  const visible = questions.filter((question) => {
    if (statusFilter && question.status !== statusFilter) return false;
    const needle = search.trim();
    return !needle || question.stem.includes(needle);
  });

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await reload();
    } catch (error) {
      setActionError(describeError(error, fallback, errorToText));
    } finally {
      setBusy(false);
    }
  }

  async function saveQuestion() {
    if (!form) return;
    const payload = buildQuestionPayload(form, courseId);
    await run(async () => {
      if (form.id === null) {
        await createQuestion(slug, form.type, payload);
      } else {
        await updateQuestion(slug, form.id, payload);
      }
      setForm(null);
    }, "تعذّر حفظ السؤال.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="question-status-filter">الحالة</Label>
            <Select
              id="question-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as QuestionStatus | "")}
              className="min-h-11"
            >
              <option value="">الكل</option>
              {Object.entries(QUESTION_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="question-search">بحث في نص السؤال</Label>
            <Input
              id="question-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-11"
            />
          </div>
        </div>
        <Button
          className="min-h-11"
          onClick={() => {
            setForm(emptyQuestionForm());
          }}
          disabled={busy}
        >
          سؤال جديد
        </Button>
      </div>

      {form && (
        <Card>
          <div role="heading" aria-level={2} className="text-lg font-bold text-ink">
            {form.id === null ? "سؤال جديد" : "تعديل السؤال"}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="question-type">نوع السؤال</Label>
              <Select
                id="question-type"
                value={form.type}
                disabled={form.id !== null}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as QuestionType })
                }
              >
                {Object.entries(QUESTION_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              {form.id !== null && (
                <p className="mt-1 text-xs text-ink-muted">لا يمكن تغيير نوع السؤال بعد إنشائه.</p>
              )}
            </div>
            <div>
              <Label htmlFor="question-difficulty">الصعوبة</Label>
              <Select
                id="question-difficulty"
                value={form.difficulty}
                onChange={(event) =>
                  setForm({ ...form, difficulty: event.target.value as QuestionDifficulty })
                }
              >
                {Object.entries(DIFFICULTY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="question-stem">نص السؤال</Label>
              <Textarea
                id="question-stem"
                rows={3}
                maxLength={5000}
                value={form.stem}
                onChange={(event) => setForm({ ...form, stem: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="question-points">النقاط</Label>
              <Input
                id="question-points"
                type="number"
                min="0.01"
                step="0.01"
                value={form.points}
                onChange={(event) => setForm({ ...form, points: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="question-topics">الموضوعات</Label>
              <select
                id="question-topics"
                multiple
                value={form.topicIds.map(String)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    topicIds: Array.from(event.target.selectedOptions).map((option) => Number(option.value)),
                  })
                }
                className="min-h-24 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              >
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-muted">اختياري — استخدم Ctrl لتحديد أكثر من موضوع.</p>
            </div>
          </div>

          <div className="mt-5 rounded-control border border-line p-4">
            <p className="text-sm font-bold text-ink">الإجابة الصحيحة</p>

            {form.type === "mcq" && (
              <div className="mt-3 space-y-2">
                {form.options.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct-option"
                      id={`correct-${option.id}`}
                      checked={form.correctOptionId === option.id}
                      onChange={() => setForm({ ...form, correctOptionId: option.id })}
                      className="h-5 w-5 shrink-0 accent-accent"
                      aria-label={`الخيار ${option.id} هو الصحيح`}
                    />
                    <Input
                      value={option.text}
                      maxLength={500}
                      placeholder={`الخيار ${option.id}`}
                      onChange={(event) => {
                        const options = form.options.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, text: event.target.value } : row,
                        );
                        setForm({ ...form, options });
                      }}
                    />
                    <Button
                      variant="ghost"
                      className="min-h-9 px-2 text-xs"
                      disabled={form.options.length <= 2}
                      onClick={() =>
                        setForm({
                          ...form,
                          options: form.options.filter((row) => row.id !== option.id),
                          correctOptionId:
                            form.correctOptionId === option.id ? form.options[0].id : form.correctOptionId,
                        })
                      }
                    >
                      حذف
                    </Button>
                  </div>
                ))}
                {form.options.length < OPTION_IDS.length && (
                  <Button
                    variant="secondary"
                    className="min-h-9 px-3 text-xs"
                    onClick={() =>
                      setForm({
                        ...form,
                        options: [
                          ...form.options,
                          { id: OPTION_IDS[form.options.length], text: "" },
                        ],
                      })
                    }
                  >
                    إضافة خيار
                  </Button>
                )}
              </div>
            )}

            {form.type === "true_false" && (
              <div className="mt-3 flex gap-4">
                {[
                  { value: true, label: "صحيح" },
                  { value: false, label: "خطأ" },
                ].map((item) => (
                  <Label key={String(item.value)} htmlFor={`tf-${item.value}`} className="flex items-center gap-2">
                    <input
                      id={`tf-${item.value}`}
                      type="radio"
                      name="true-false"
                      checked={form.trueFalse === item.value}
                      onChange={() => setForm({ ...form, trueFalse: item.value })}
                      className="h-5 w-5 accent-accent"
                    />
                    <span>{item.label}</span>
                  </Label>
                ))}
              </div>
            )}

            {form.type === "short" && (
              <div className="mt-3">
                <Label htmlFor="short-answers">الإجابات المقبولة (سطر لكل إجابة)</Label>
                <Textarea
                  id="short-answers"
                  rows={3}
                  value={form.shortAnswers}
                  onChange={(event) => setForm({ ...form, shortAnswers: event.target.value })}
                  placeholder={"4\nأربعة"}
                />
              </div>
            )}

            {form.type === "essay" && (
              <div className="mt-3">
                <Label htmlFor="essay-answer">الإجابة النموذجية</Label>
                <Textarea
                  id="essay-answer"
                  rows={3}
                  value={form.essayAnswer}
                  onChange={(event) => setForm({ ...form, essayAnswer: event.target.value })}
                />
              </div>
            )}
          </div>

          <div className="mt-4">
            <Label htmlFor="question-explanation">التفسير (اختياري)</Label>
            <Textarea
              id="question-explanation"
              rows={2}
              value={form.explanation}
              onChange={(event) => setForm({ ...form, explanation: event.target.value })}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => void saveQuestion()} disabled={busy || !form.stem.trim()}>
              {busy ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
            <Button variant="ghost" onClick={() => setForm(null)} disabled={busy}>
              إلغاء
            </Button>
          </div>
        </Card>
      )}

      {visible.length === 0 ? (
        <EmptyState title="لا توجد أسئلة مطابقة" hint="غيّر الفلتر أو أضف سؤالًا جديدًا." />
      ) : (
        <ul className="space-y-3">
          {visible.map((question) => (
            <li key={question.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn(badge, "bg-soft text-ink-secondary")}>
                        {QUESTION_TYPE_LABEL[question.question_type]}
                      </span>
                      <span className={cn(badge, "bg-soft text-ink-secondary")}>
                        {DIFFICULTY_LABEL[question.difficulty]}
                      </span>
                      <span
                        className={cn(
                          badge,
                          question.status === "approved"
                            ? "bg-success-bg text-success"
                            : question.status === "draft"
                              ? "bg-warn-bg text-warn"
                              : question.status === "rejected"
                                ? "bg-err-bg text-err"
                                : "bg-soft text-ink-muted",
                        )}
                      >
                        {QUESTION_STATUS_LABEL[question.status]}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {arDigits(question.points)} نقطة
                      </span>
                    </div>
                    <p dir="auto" className="mt-2 text-sm leading-7 text-ink">
                      {question.stem}
                    </p>
                    {question.topics.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1.5 text-xs text-ink-muted">
                        {question.topics.map((topic) => (
                          <span key={topic.id} className="rounded-full bg-soft px-2 py-0.5">
                            {topic.name}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {question.status !== "archived" && (
                      <Button
                        variant="secondary"
                        className="min-h-11"
                        onClick={() => setForm(questionToForm(question))}
                      >
                        تعديل
                      </Button>
                    )}
                    {question.status === "draft" && (
                      <>
                        <Button
                          className="min-h-11"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () => questionAction(slug, question.id, "approve"),
                              "تعذّر اعتماد السؤال.",
                            )
                          }
                        >
                          اعتماد
                        </Button>
                        <Button
                          variant="ghost"
                          className="min-h-11"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () => questionAction(slug, question.id, "reject"),
                              "تعذّر رفض السؤال.",
                            )
                          }
                        >
                          رفض
                        </Button>
                      </>
                    )}
                    {question.status !== "archived" && (
                      <Button
                        variant="ghost"
                        className="min-h-11"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => questionAction(slug, question.id, "archive"),
                            "تعذّر أرشفة السؤال.",
                          )
                        }
                      >
                        أرشفة
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Topics ---------- */

function TopicsTab({
  slug,
  courseId,
  topics,
  busy,
  setBusy,
  setActionError,
  errorToText,
  reload,
}: TabProps & { topics: Topic[] }) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await reload();
    } catch (error) {
      setActionError(describeError(error, fallback, errorToText));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div role="heading" aria-level={2} className="text-lg font-bold text-ink">
          إضافة موضوع
        </div>
        <p className="mt-1 text-sm text-ink-secondary">
          الموضوعات تُستخدم لوسم الأسئلة داخل الدورة.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Label htmlFor="topic-name">اسم الموضوع</Label>
            <Input
              id="topic-name"
              value={name}
              maxLength={150}
              onChange={(event) => setName(event.target.value)}
              className="min-h-11"
            />
          </div>
          <Button
            className="min-h-11"
            disabled={busy || !name.trim()}
            onClick={() =>
              void run(async () => {
                await createTopic(slug, { name: name.trim(), course: courseId });
                setName("");
              }, "تعذّر إضافة الموضوع.")
            }
          >
            إضافة
          </Button>
        </div>
      </Card>

      {topics.length === 0 ? (
        <EmptyState title="لا موضوعات لهذه الدورة" hint="أضف موضوعًا لتوسيم الأسئلة." />
      ) : (
        <ul className="space-y-2">
          {topics.map((topic) => (
            <li
              key={topic.id}
              className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-3"
            >
              {editing?.id === topic.id ? (
                <>
                  <Input
                    value={editing.name}
                    maxLength={150}
                    onChange={(event) => setEditing({ id: topic.id, name: event.target.value })}
                    className="min-h-10 flex-1"
                  />
                  <Button
                    className="min-h-10"
                    disabled={busy || !editing.name.trim()}
                    onClick={() =>
                      void run(async () => {
                        await updateTopic(slug, topic.id, { name: editing.name.trim() });
                        setEditing(null);
                      }, "تعذّر تعديل الموضوع.")
                    }
                  >
                    حفظ
                  </Button>
                  <Button variant="ghost" className="min-h-10" onClick={() => setEditing(null)}>
                    إلغاء
                  </Button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{topic.name}</span>
                  <span dir="ltr" className="text-xs text-ink-muted">
                    {topic.slug}
                  </span>
                  <Button
                    variant="secondary"
                    className="min-h-10"
                    onClick={() => setEditing({ id: topic.id, name: topic.name })}
                  >
                    تعديل
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
