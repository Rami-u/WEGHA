import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listStudentExams } from "../../../api/assessments";
import { Button, Card, CourseCover, EnrollmentBadge, PageHeader } from "../../../components/ui";
import { useSession } from "../../../context/SessionContext";
import type { Course, StudentExam } from "../../../types/api";
import { arDigits, assetTypeLabel, sampleAssets, sampleLessons, sampleSections, sampleTopics } from "../../course-content/sampleContent";

function CourseIcon({ name }: { name: "book" | "arrow" | "check" | "file" | "exam" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden>
      {name === "book" && <><path d="M3 4c3-1 6 0 9 2v15c-3-2-6-3-9-2V4Z" /><path d="M12 6c3-2 6-3 9-2v15c-3-1-6 0-9 2" /></>}
      {name === "arrow" && <path d="M20 12H4m7-7-7 7 7 7" />}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "file" && <><path d="M14 3H5v18h14V8l-5-5Z" /><path d="M14 3v5h5M8 12h8M8 16h5" /></>}
      {name === "exam" && <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h3" /></>}
    </svg>
  );
}

const linkBase = "inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-4 py-3 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";
const lessons = sampleLessons.filter((lesson) => lesson.isPublished);
const resources = sampleAssets.filter((asset) => lessons.some((lesson) => lesson.id === asset.lessonId));

/** Design-only overview: sample curriculum and an explicitly temporary study checklist. */
export default function ActiveCourseOverview({ course }: { course: Course }) {
  const { publicProfile, workspace, slug } = useSession();
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [exams, setExams] = useState<StudentExam[]>([]);
  const next = lessons.find((lesson) => !reviewed.includes(lesson.id));
  const readyFiles = resources.filter((asset) => asset.extractionStatus === "done").length;
  const lessonPath = (id: string) => `/courses/${course.id}/lessons/${id}`;
  const examListPath = `/courses/${course.id}/exams`;
  const examPath = exams[0] ? `${examListPath}/${exams[0].id}` : examListPath;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listStudentExams(slug ?? "");
        if (!cancelled) setExams(rows.filter((exam) => exam.course.id === course.id));
      } catch {
        if (!cancelled) setExams([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, course.id]);

  function toggleReview(id: string) {
    setReviewed((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <div className="space-y-6">
      <Link to="/courses" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-accent hover:underline">مكتبة دوراتي / تفاصيل الدورة</Link>

      <section className="overflow-hidden rounded-panel border border-line bg-surface" aria-label="نظرة عامة على الدورة">
        <div className="flex flex-wrap items-start gap-5 bg-section p-6 sm:p-8">
          <CourseCover courseId={course.id} title={course.title} size={64} />
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <EnrollmentBadge status="active" />
              <span className="text-sm text-ink">مساحة {publicProfile?.teacher_name || workspace?.name || "معلّمك"}</span>
              <span className="rounded-pill border border-line bg-surface px-3 py-1 text-sm text-ink">محتوى تجريبي للمعاينة</span>
            </div>
            <div className="[&_h1]:text-2xl [&_h1]:font-extrabold sm:[&_h1]:text-3xl">
              <PageHeader title={course.title} subtitle="كل ما تحتاجه لمتابعة الدورة، في مكان واحد." />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-line border-t border-line py-5 text-center">
          {[{ value: lessons.length, label: "دروس متاحة" }, { value: sampleSections.length, label: "وحدات تعليمية" }, { value: exams.length, label: "اختبارات منشورة" }].map((stat) => (
            <div key={stat.label} className="px-2"><div className="text-2xl font-extrabold text-ink">{arDigits(stat.value)}</div><div className="mt-1 text-sm text-ink">{stat.label}</div></div>
          ))}
        </div>
      </section>

      <div className="flex flex-col justify-between gap-5 rounded-panel bg-panel p-6 text-panel-fg sm:flex-row sm:items-center sm:p-8">
        <div>
          <div className="mb-2 text-sm">خطوتك التالية</div>
          <div role="heading" aria-level={2} className="text-xl font-extrabold">{next ? next.title : "راجعت الدروس؟ اختبر فهمك."}</div>
          <div className="mt-2 text-sm leading-7">{next ? "افتح الدرس، وراجع أمثلته قبل الانتقال إلى الخطوة التالية." : "الاختبار فرصة لتعرف ما أتقنته وما يحتاج إلى مراجعة."}</div>
        </div>
        <Link to={next ? lessonPath(next.id) : examPath} className={`${linkBase} shrink-0 bg-surface text-accent hover:bg-soft`}>{next ? reviewed.length ? "تابع المذاكرة" : "ابدأ التعلّم" : "افتح الاختبار"}<CourseIcon name="arrow" /></Link>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div role="heading" aria-level={2} className="flex items-center gap-2 text-lg font-bold text-ink"><CourseIcon name="book" />محتوى الدورة</div>
              <span className="text-sm text-ink">{arDigits(lessons.length)} دروس منشورة</span>
            </div>
            <div className="mt-5 space-y-3">
              {sampleSections.map((section, index) => {
                const sectionLessons = lessons.filter((lesson) => lesson.sectionId === section.id);
                return (
                  <details key={section.id} open className="rounded-card border border-line">
                    <summary className="cursor-pointer rounded-control bg-soft p-4 font-bold text-ink focus-visible:outline-accent">الوحدة {arDigits(index + 1)} · {section.title}<span className="ms-2 text-sm font-normal">({arDigits(sectionLessons.length)} دروس)</span></summary>
                    <div className="divide-y divide-line px-4">
                      {sectionLessons.map((lesson) => (
                        <div key={lesson.id} className="flex flex-wrap items-center gap-3 py-4">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent" aria-hidden>{reviewed.includes(lesson.id) ? <CourseIcon name="check" /> : arDigits(lessons.indexOf(lesson) + 1)}</span>
                          <Link to={lessonPath(lesson.id)} className="min-w-0 flex-1 basis-40 rounded-control text-sm font-bold leading-7 text-ink hover:text-accent focus-visible:outline-accent">
                            {lesson.title}
                            <span className="block font-normal">{arDigits(resources.filter((asset) => asset.lessonId === lesson.id).length)} مرفق {lesson.examId ? " · يتبعه اختبار" : ""}</span>
                          </Link>
                          <Button variant={reviewed.includes(lesson.id) ? "secondary" : "ghost"} aria-pressed={reviewed.includes(lesson.id)} aria-label={`${reviewed.includes(lesson.id) ? "إلغاء مراجعة" : "تحديد مراجعة"} ${lesson.title}`} onClick={() => toggleReview(lesson.id)} className="min-h-11">{reviewed.includes(lesson.id) ? "تمت المراجعة" : "حدّد كمُراجَع"}</Button>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </Card>

          <Card>
            <div role="heading" aria-level={2} className="flex items-center gap-2 text-lg font-bold text-ink"><CourseIcon name="file" />ملفات ومصادر الدورة</div>
            <div className="mt-2 text-sm leading-7 text-ink">كل ملف موجود داخل الدرس الخاص به؛ راجع الشرح أولًا للاستفادة منه.</div>
            <div className="mt-4 divide-y divide-line">
              {resources.map((asset) => (
                <div key={asset.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0 flex-1 basis-40">
                    <div dir="auto" className="break-words text-sm font-bold text-ink">{asset.fileName}</div>
                    <div className="mt-1 text-sm text-ink">{assetTypeLabel(asset.assetType)} · {asset.extractionStatus === "done" ? "جاهز في نموذج العرض" : "قيد التجهيز"}</div>
                  </div>
                  <Link to={lessonPath(asset.lessonId)} className={`${linkBase} border border-line text-accent hover:bg-soft`}>الدرس المرتبط<CourseIcon name="arrow" /></Link>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <aside className="space-y-6" aria-label="خطة المذاكرة ومعلومات الدورة">
          <Card>
            <div role="heading" aria-level={2} className="text-lg font-bold text-ink">خطة مذاكرتك</div>
            <div className="mt-4 flex items-baseline gap-2 text-ink" role="status"><span className="text-3xl font-extrabold text-accent">{arDigits(reviewed.length)}</span><span>من {arDigits(lessons.length)} دروس راجعتها</span></div>
            <div className="mt-4 flex gap-2" aria-hidden>{lessons.map((lesson) => <span key={lesson.id} className={`h-2 flex-1 rounded-pill ${reviewed.includes(lesson.id) ? "bg-accent" : "bg-soft"}`} />)}</div>
            <div className="mt-4 text-sm leading-7 text-ink">حدّد الدروس التي راجعتها لتنظيم جلستك. هذه قائمة مؤقتة تُصفّر عند مغادرة الصفحة، وليست سجل إنجاز.</div>
          </Card>

          <Card className="bg-accent-soft">
            <div className="mb-3 flex items-center gap-2 text-accent"><CourseIcon name="exam" /><span className="text-sm font-bold">بعد المذاكرة</span></div>
            <div role="heading" aria-level={2} className="text-lg font-bold text-ink">اختبارات الدورة</div>
            {exams.length === 0 ? (
              <p className="mt-2 text-sm leading-7 text-ink">لا اختبارات منشورة في هذه الدورة بعد.</p>
            ) : (
              <>
                <div className="mt-2 text-sm leading-7 text-ink">{arDigits(exams.length)} اختبار منشور ومتاح لك.</div>
                <dl className="my-5 space-y-3 text-sm text-ink">
                  {exams.slice(0, 3).map((exam) => (
                    <div key={exam.id} className="flex justify-between gap-2">
                      <dt className="min-w-0 truncate">{exam.title}</dt>
                      <dd className="shrink-0 font-bold">
                        {arDigits(exam.attempts_used)}/{arDigits(exam.max_attempts)} محاولات
                      </dd>
                    </div>
                  ))}
                </dl>
                <Link to={examPath} className={`${linkBase} w-full bg-accent text-accent-contrast hover:opacity-90`}>فتح الاختبار<CourseIcon name="arrow" /></Link>
                <Link to={examListPath} className="mt-3 block text-center text-sm font-bold text-accent hover:underline">كل الاختبارات</Link>
              </>
            )}
          </Card>

          <Card>
            <div role="heading" aria-level={2} className="text-lg font-bold text-ink">عن الدورة</div>
            <div className="mt-3 whitespace-pre-line text-sm leading-8 text-ink">{course.description || "لم يكتب المعلّم وصفًا لهذه الدورة بعد."}</div>
            <div className="mt-5 border-t border-line pt-4">
              <div className="mb-3 text-sm font-bold text-ink">موضوعات المحتوى التجريبي</div>
              <div className="flex flex-wrap gap-2">{sampleTopics.filter((topic) => lessons.some((lesson) => lesson.topicIds.includes(topic.id))).map((topic) => <span key={topic.id} className="rounded-pill bg-soft px-3 py-2 text-sm text-ink">{topic.name}</span>)}</div>
              <div className="mt-4 text-sm text-ink">{arDigits(readyFiles)} مرفقات جاهزة · {arDigits(resources.length - readyFiles)} قيد التجهيز</div>
            </div>
          </Card>
        </aside>
      </div>
      <div className="rounded-card border border-dashed border-line p-4 text-sm leading-7 text-ink">الوحدات والدروس والملفات في هذه الصفحة محتوى تجريبي لتوضيح الواجهة، وليست بيانات فعلية لهذه الدورة. أما بطاقة الاختبارات فتُقرأ من الـAPI الفعلي، ولا يتم حفظ قائمة المراجعة أو إرسالها إلى المعلّم.</div>
    </div>
  );
}
