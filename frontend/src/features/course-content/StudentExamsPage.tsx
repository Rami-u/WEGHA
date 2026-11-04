import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { listStudentExams } from "../../api/assessments";
import { getCourse } from "../../api/courses";
import { Alert, Button, Card, EmptyState, FullPageSpinner } from "../../components/ui";
import { useSession } from "../../context/SessionContext";
import { useApiErrorText } from "../../lib/apiErrorText";
import { ApiError } from "../../lib/apiClient";
import type { Course, StudentExam } from "../../types/api";
import { arDigits } from "./sampleContent";
import { ContentHeader } from "./ContentUI";

/*
  Student exam list for one course. Real data from the assessments API: only
  published exams in courses with an active enrollment are returned, without
  questions or passing scores.
*/
export function StudentExamsPage() {
  const params = useParams();
  const courseId = Number(params.courseId);
  const { slug } = useSession();
  const errorToText = useApiErrorText();

  const [course, setCourse] = useState<Course | null>(null);
  const [exams, setExams] = useState<StudentExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [courseRow, examRows] = await Promise.all([
          getCourse(slug ?? "", courseId),
          listStudentExams(slug ?? ""),
        ]);
        if (cancelled) return;
        setCourse(courseRow);
        setExams(examRows.filter((exam) => exam.course.id === courseId));
      } catch (error) {
        if (!cancelled) {
          setErrorText(errorToText(error as ApiError, "تعذّر تحميل اختبارات الدورة."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, courseId, errorToText]);

  if (loading) {
    return <FullPageSpinner />;
  }

  return (
    <div>
      <ContentHeader
        title={course ? `اختبارات · ${course.title}` : "اختبارات الدورة"}
        hint="الاختبارات المنشورة في هذه الدورة، والمحاولات المتاحة لكل اختبار."
        back={`/courses/${courseId}`}
        backLabel="العودة إلى الدورة"
        note={null}
      />

      {errorText && (
        <div className="mb-4">
          <Alert tone="error">{errorText}</Alert>
        </div>
      )}

      {!errorText && exams.length === 0 && (
        <EmptyState
          title="لا اختبارات منشورة لهذه الدورة بعد"
          hint="سيظهر الاختبار هنا بعد أن ينشره المعلّم ويسجّل في الدورة تسجيلًا نشطًا."
        />
      )}

      <ul className="space-y-4">
        {exams.map((exam) => {
          const attemptsLeft = Math.max(0, exam.max_attempts - exam.attempts_used);
          const inProgress = exam.in_progress_attempt_id !== null;
          return (
            <li key={exam.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold text-ink">{exam.title}</span>
                      {exam.proctoring_enabled && (
                        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                          بمراقبة
                        </span>
                      )}
                      {inProgress && (
                        <span className="rounded-full bg-warn-bg px-2.5 py-0.5 text-xs font-semibold text-warn">
                          محاولة جارية
                        </span>
                      )}
                    </div>
                    {exam.description && (
                      <p className="mt-2 text-sm leading-7 text-ink-secondary">{exam.description}</p>
                    )}
                    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-secondary">
                      <div className="flex gap-1">
                        <dt>الأسئلة:</dt>
                        <dd className="font-semibold text-ink">{arDigits(exam.question_count)}</dd>
                      </div>
                      <div className="flex gap-1">
                        <dt>النقاط:</dt>
                        <dd className="font-semibold text-ink">{arDigits(exam.total_points)}</dd>
                      </div>
                      <div className="flex gap-1">
                        <dt>المدة:</dt>
                        <dd className="font-semibold text-ink">
                          {exam.duration_minutes ? `${arDigits(exam.duration_minutes)} دقيقة` : "حسب إعداد المعلّم"}
                        </dd>
                      </div>
                      <div className="flex gap-1">
                        <dt>المحاولات:</dt>
                        <dd className="font-semibold text-ink">
                          {arDigits(exam.attempts_used)} / {arDigits(exam.max_attempts)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="flex flex-col items-stretch gap-2">
                    <Link to={`/courses/${courseId}/exams/${exam.id}`}>
                      <Button className="w-full">
                        {inProgress ? "متابعة المحاولة" : attemptsLeft > 0 ? "فتح الاختبار" : "لا محاولات متاحة"}
                      </Button>
                    </Link>
                    {attemptsLeft === 0 && !inProgress && (
                      <span className="text-center text-xs text-ink-muted">
                        استُخدمت كل المحاولات المتاحة.
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
