import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getCourse } from "../../api/courses";
import { Button, CourseCover, FullPageSpinner } from "../../components/ui";
import { ContentHeader, LessonReflection, contentLink } from "./ContentUI";
import { cn } from "../../components/ui";
import { useApiErrorText } from "../../lib/apiErrorText";
import { ApiError } from "../../lib/apiClient";
import { useSession } from "../../context/SessionContext";
import type { Course } from "../../types/api";
import {
  assetTypeLabel,
  arDigits,
  extractionStatusLabel,
  sampleAssets,
  sampleExam,
  sampleLessons,
  sampleSections,
  sampleTopics,
} from "./sampleContent";

/*
  Student lesson view — Stage 6 content preview.
  The course header is real API data; sections/lessons/assets are the sample
  content, clearly labelled, until the backend content endpoints exist.
*/

export function LessonViewPage() {
  const params = useParams();
  const courseId = Number(params.courseId);
  const lessonId = useParams().lessonId ?? sampleLessons[0].id;
  const { slug } = useSession();
  const errorToText = useApiErrorText();

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const current = sampleLessons.find((lesson) => lesson.id === lessonId) ?? sampleLessons[0];
  const currentAsset = sampleAssets.filter((asset) => asset.lessonId === current.id);
  const currentIndex = sampleLessons.findIndex((lesson) => lesson.id === current.id);
  const previousLesson = currentIndex > 0 ? sampleLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < sampleLessons.length - 1 ? sampleLessons[currentIndex + 1] : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getCourse(slug ?? "", courseId);
        if (!cancelled) setCourse(loaded);
      } catch (error) {
        if (!cancelled) setErrorText(errorToText(error as ApiError, "تعذّر تحميل هذه الدورة."));
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

  if (!course) {
    return (
      <div className="text-center">
        <p className="font-bold text-ink">لم يتم العثور على الدورة</p>
        {errorText && <p className="mt-2 text-sm text-ink-secondary">{errorText}</p>}
        <Link to="/courses" className="mt-6 inline-block">
          <Button variant="secondary">العودة إلى الدورات</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
    <ContentHeader title={course.title} hint="اقرأ الشرح، راجع الأمثلة، ثم اختبر فهمك خطوة بخطوة." back={`/courses/${courseId}`} backLabel="العودة إلى تفاصيل الدورة" />
    <div className="grid items-start gap-6 lg:grid-cols-3">
      {/* Sidebar outline */}
      <aside className="rounded-card border border-line bg-surface p-5 lg:sticky lg:top-6">
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <CourseCover courseId={course.id} title={course.title} size={44} />
          <div className="min-w-0">
            <p className="truncate font-bold text-ink">{course.title}</p>
            <div className="mt-2 text-sm text-ink">موضعك: الدرس {arDigits(currentIndex + 1)} من {arDigits(sampleLessons.length)}</div>
          </div>
        </div>

        <nav className="mt-4 space-y-4" aria-label="محتوى الدورة">
          {sampleSections.map((section) => (
            <div key={section.id}>
              <p className="text-sm font-bold text-ink">
                {section.title}
              </p>
              <ul className="mt-2 space-y-1">
                {sampleLessons
                  .filter((lesson) => lesson.sectionId === section.id)
                  .map((lesson) => (
                    <li key={lesson.id}>
                      <Link
                        to={`/courses/${courseId}/lessons/${lesson.id}`}
                        aria-current={lesson.id === current.id ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center justify-between gap-2 rounded-control px-3 py-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                          lesson.id === current.id
                            ? "bg-accent-soft font-semibold text-accent"
                            : "text-ink hover:bg-soft",
                        )}
                      >
                        <span className="truncate">{lesson.title}</span>
                        {!lesson.isPublished && (
                          <span className="shrink-0 rounded-full bg-soft px-2 py-0.5 text-[10px] text-ink-muted">
                            مسوّدة للمعاينة
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Lesson content */}
      <article className="min-w-0 lg:col-span-2">
        <div className="rounded-card border border-line bg-surface p-6">
          <div role="heading" aria-level={2} className="mb-4 text-2xl font-extrabold leading-relaxed text-ink">{current.title}</div>
          <div className="mb-5 flex flex-wrap gap-2">{current.topicIds.map((id) => <span key={id} className="rounded-pill bg-accent-soft px-3 py-2 text-sm text-accent">{sampleTopics.find((topic) => topic.id === id)?.name}</span>)}</div>
          {!current.isPublished && <div className="mb-4 rounded-control bg-soft p-4 text-sm leading-7 text-ink">درس مسوّدة متاح هنا للتنقّل في التصميم فقط، وليس درسًا منشورًا للطلاب.</div>}

          {current.content.split("\n\n").map((paragraph, index) => (
            <p key={index} className="mt-4 leading-[2.1] text-ink first:mt-4">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Assets */}
        {currentAsset.length > 0 && (
          <div className="mt-4 rounded-card border border-line bg-surface p-5">
            <div role="heading" aria-level={2} className="font-bold text-ink">ملفات الدرس</div>
            <div className="mt-2 text-sm leading-7 text-ink">أسماء وحالات توضيحية؛ لا يوجد ملف فعلي للتنزيل في هذه المعاينة.</div>
            <ul className="mt-3 space-y-2">
              {currentAsset.map((asset) => (
                <li
                  key={asset.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-soft px-4 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-card bg-accent-soft text-sm text-accent"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" className="h-5 w-5"><path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8M8 16h5" /></svg>
                    </span>
                    <div className="min-w-0">
                      <p dir="auto" className="truncate text-sm font-semibold text-ink">
                        {asset.fileName}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {assetTypeLabel(asset.assetType)} · {extractionStatusLabel(asset.extractionStatus)}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" disabled>
                    {asset.extractionStatus === "pending" || asset.extractionStatus === "failed"
                      ? "غير متاح الآن"
                        : "ملف تجريبي"}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <LessonReflection key={`${slug}:${courseId}:${current.id}`} />

        {/* Linked exam */}
        {current.examId === sampleExam.id && (
          <div className="mt-4 rounded-card border border-line bg-soft p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-bold text-ink">اختبارات الدورة</p>
                <p className="mt-1 text-sm text-ink-secondary">
                  تعرض صفحة الاختبارات الاختبارات المنشورة فعليًا في هذه الدورة ومحاولاتك المتاحة.
                </p>
              </div>
              <Link to={`/courses/${courseId}/exams`}>
                <Button>اختبارات الدورة</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Prev / next */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          {previousLesson ? (
            <Link
              to={`/courses/${courseId}/lessons/${previousLesson.id}`}
              className={contentLink}
            >
              → الدرس السابق: {previousLesson.title}
            </Link>
          ) : (
            <span />
          )}
          {nextLesson ? (
            <Link
              to={`/courses/${courseId}/lessons/${nextLesson.id}`}
              className={contentLink}
            >
              الدرس التالي: {nextLesson.title} ←
            </Link>
          ) : (
            <span />
          )}
        </div>
      </article>
    </div>
    </div>
  );
}
