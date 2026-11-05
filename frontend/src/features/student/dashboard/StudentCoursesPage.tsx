import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { listCourses } from "../../../api/courses";
import { Alert, Button, Card, CourseCover, EnrollmentBadge, EmptyState, FullPageSpinner, Input, Label, PageHeader, PriceTag, Select, courseTileKey } from "../../../components/ui";
import { useSession } from "../../../context/SessionContext";
import { useApiErrorText } from "../../../lib/apiErrorText";
import { ApiError } from "../../../lib/apiClient";
import type { Course } from "../../../types/api";
import "./course-library.css";

function LibraryIcon({ name, className = "h-5 w-5" }: { name: "book" | "search" | "arrow" | "play" | "grid" | "list" | "clock" | "check"; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {name === "book" && <><path d="M3 4.5c3-1 6-1 9 1v15c-3-2-6-2-9-1v-15Z" /><path d="M12 5.5c3-2 6-2 9-1v15c-3-1-6-1-9 1v-15Z" /></>}
      {name === "search" && <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>}
      {name === "arrow" && <path d="M20 12H4m7-7-7 7 7 7" />}
      {name === "play" && <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4V8Z" /></>}
      {name === "grid" && <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>}
      {name === "list" && <path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1" />}
      {name === "clock" && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
    </svg>
  );
}

const FILTERS = [
  { value: "all", label: "كل الدورات" },
  { value: "active", label: "دوراتي النشطة" },
  { value: "pending_payment", label: "بانتظار الدفع" },
  { value: "available", label: "لم أشترك بعد" },
  { value: "free", label: "مجانية" },
] as const;
type CourseFilter = (typeof FILTERS)[number]["value"];

function matchesFilter(course: Course, filter: CourseFilter) {
  if (filter === "all") return true;
  if (filter === "free") return Number(course.price) === 0;
  if (filter === "available") return !course.enrollment_status;
  return course.enrollment_status === filter;
}

/** Course list for approved students (with their enrollment status) and teachers. */
export function StudentCoursesPage() {
  const { slug, user, publicProfile, workspace } = useSession();
  const [params, setParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const errorToText = useApiErrorText();

  const isTeacher = user?.role === "teacher";
  const search = params.get("q") ?? "";
  const filter: CourseFilter = FILTERS.find((item) => item.value === params.get("filter"))?.value ?? "all";
  const sort = ["name", "price-low", "price-high", "newest"].includes(params.get("sort") ?? "") ? params.get("sort")! : "default";
  const view = params.get("view") === "list" ? "list" : "grid";
  const teacherName = publicProfile?.teacher_name || workspace?.name || "معلّمك";
  const activeCourses = courses.filter((course) => course.enrollment_status === "active");
  const pendingCount = courses.filter((course) => course.enrollment_status === "pending_payment").length;
  const featured = !isTeacher ? activeCourses[0] : undefined;

  function updateParam(key: string, value: string, replace = false) {
    const next = new URLSearchParams(params);
    const defaults: Record<string, string> = { q: "", filter: "all", sort: "default", view: "grid" };
    if (!value || value === defaults[key]) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace });
  }

  const visibleCourses = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("ar");
    const list = courses.filter((course) => matchesFilter(course, filter) && `${course.title} ${course.description ?? ""}`.toLocaleLowerCase("ar").includes(term));
    if (sort === "name") list.sort((a, b) => a.title.localeCompare(b.title, "ar"));
    if (sort === "price-low") list.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price-high") list.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === "newest") list.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return list;
  }, [courses, filter, search, sort]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorText(null);
      try {
        const courses = await listCourses(slug ?? "");
        if (!cancelled) setCourses(courses);
      } catch (error) {
        if (!cancelled) setErrorText(errorToText(error as ApiError, "تعذّر تحميل الدورات."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, retry, errorToText]);

  if (loading) {
    return <FullPageSpinner />;
  }

  return (
    <div className="course-library space-y-6">
      <section className="overflow-hidden rounded-panel border border-line bg-surface">
        <div className="flex flex-col justify-between gap-6 bg-section p-6 sm:p-8 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <span className="mb-4 inline-flex items-center gap-2 rounded-pill bg-surface/75 px-3 py-1 text-xs font-semibold text-accent"><LibraryIcon name="book" className="h-4 w-4" />كل دورة، خطوة أقرب لوجهتك</span>
            <div className="[&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:leading-relaxed sm:[&_h1]:text-4xl">
              <PageHeader title={isTeacher ? "الدورات" : "مكتبة الدورات"} subtitle={isTeacher ? "جميع دوراتك بما فيها المسوّدات." : "اكتشف ما تريد تعلّمه، وتابع الدورات المتاحة في مساحتك."} />
            </div>
            <p className="text-xs text-ink-secondary">مساحة {teacherName}</p>
          </div>
          {!isTeacher && <Link to="/my-enrollments" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 self-start rounded-control border border-line bg-surface px-5 py-3 text-sm font-semibold text-accent hover:bg-soft">تسجيلاتي<LibraryIcon name="arrow" /></Link>}
        </div>
        {!errorText && (
          <dl className="library-stats grid grid-cols-3 px-3 py-5 sm:px-6">
            {[
              { label: "دورة في المكتبة", value: courses.length, icon: "book" as const, tone: "text-accent" },
              { label: "دورة نشطة", value: activeCourses.length, icon: "check" as const, tone: "text-success" },
              { label: "بانتظار الدفع", value: pendingCount, icon: "clock" as const, tone: "text-warn" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center justify-center gap-1 px-2 sm:flex-row sm:gap-4">
                <span className={`hidden rounded-card bg-soft p-3 sm:inline-flex ${stat.tone}`}><LibraryIcon name={stat.icon} /></span>
                <div className="flex flex-col text-center sm:text-start"><dt className="order-2 text-xs text-ink-muted">{stat.label}</dt><dd className="order-1 text-2xl font-extrabold leading-relaxed text-ink">{stat.value.toLocaleString("ar")}</dd></div>
              </div>
            ))}
          </dl>
        )}
      </section>

      {featured && !errorText && (
        <Card className="library-featured">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-card border border-panel-fg/20 bg-panel-fg/5 sm:flex"><LibraryIcon name="play" className="h-8 w-8" /></span>
              <div className="min-w-0">
                <p className="mb-2 text-xs text-panel-fg/65">خطوتك التالية · دورة متاحة في حسابك</p>
                <p role="heading" aria-level={2} className="text-xl font-bold leading-relaxed">{featured.title}</p>
                <p className="mt-2 text-xs leading-relaxed text-panel-fg/70">دورتك نشطة، ويمكنك فتح الدروس والانتقال بين موضوعاتها.</p>
              </div>
            </div>
            <Link to={`/courses/${featured.id}/lessons/l1`} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-control bg-accent-soft px-5 py-3 text-sm font-semibold text-accent hover:opacity-90">افتح الدروس<LibraryIcon name="arrow" /></Link>
          </div>
        </Card>
      )}

      {errorText ? (
        <div className="space-y-4"><Alert tone="error">{errorText}</Alert><Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>إعادة المحاولة</Button></div>
      ) : courses.length === 0 ? (
        <EmptyState
          title="لا توجد دورات بعد"
          hint={isTeacher ? "أنشئ أول دورة من تبويب الدورات." : "لم ينشر المعلّم أي دورة بعد."}
        />
      ) : (
        <>
          <section className="rounded-panel border border-line bg-surface p-4 sm:p-5" aria-label="البحث وتصفية الدورات">
            <div className="grid items-end gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Label htmlFor="library-search">ابحث عن خطوتك القادمة</Label>
                <div className="relative"><span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-ink-muted"><LibraryIcon name="search" /></span><Input id="library-search" type="search" placeholder="اسم الدورة أو كلمة من وصفها..." className="h-12 ps-10" value={search} onChange={(event) => updateParam("q", event.target.value, true)} /></div>
              </div>
              <div><Label htmlFor="library-sort">ترتيب الدورات</Label><Select id="library-sort" className="h-12" value={sort} onChange={(event) => updateParam("sort", event.target.value)}><option value="default">الترتيب الافتراضي</option><option value="newest">الأحدث أولًا</option><option value="name">الاسم: أ ← ي</option><option value="price-low">السعر: الأقل أولًا</option><option value="price-high">السعر: الأعلى أولًا</option></Select></div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4" role="group" aria-label="تصفية الدورات">
              {FILTERS.map((item) => <Button key={item.value} variant={filter === item.value ? "primary" : "secondary"} size="sm" className="min-h-10" aria-pressed={filter === item.value} onClick={() => updateParam("filter", item.value)}>{item.label}<span className="ms-1 opacity-70">{courses.filter((course) => matchesFilter(course, item.value)).length.toLocaleString("ar")}</span></Button>)}
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <p role="status" className="text-sm font-semibold text-ink">نعرض {visibleCourses.length.toLocaleString("ar")} من {courses.length.toLocaleString("ar")} دورات</p>
              {(search || filter !== "all" || sort !== "default") && <Button variant="ghost" size="sm" onClick={() => setParams(view === "list" ? { view: "list" } : {})}>مسح الفلاتر</Button>}
            </div>
            <div className="inline-flex gap-1 rounded-control border border-line bg-surface p-1" role="group" aria-label="طريقة عرض الدورات">
              <Button variant={view === "grid" ? "primary" : "ghost"} size="sm" onClick={() => updateParam("view", "grid")} aria-pressed={view === "grid"} aria-label="عرض شبكي"><LibraryIcon name="grid" className="h-4 w-4" /></Button>
              <Button variant={view === "list" ? "primary" : "ghost"} size="sm" onClick={() => updateParam("view", "list")} aria-pressed={view === "list"} aria-label="عرض قائمة"><LibraryIcon name="list" className="h-4 w-4" /></Button>
            </div>
          </div>

          {visibleCourses.length === 0 ? (
            <div className="space-y-4"><EmptyState title="لا توجد دورات تطابق بحثك" hint="جرّب كلمة مختلفة أو غيّر الفلتر للوصول إلى دورات أخرى." /><Button variant="secondary" onClick={() => setParams({})}>اعرض كل الدورات</Button></div>
          ) : (
            <ul className={`grid gap-5 ${view === "grid" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`} aria-label="نتائج مكتبة الدورات">
              {visibleCourses.map((course) => (
                <li key={course.id} className={`library-tone-${courseTileKey(course.id)} min-w-0`}>
                  <Card className={`library-course flex h-full flex-col overflow-hidden transition-shadow hover:shadow-card ${view === "list" ? "sm:flex-row" : ""}`}>
                    <div className={`library-cover relative h-28 shrink-0 ${view === "list" ? "sm:h-auto sm:w-44 sm:min-h-44" : ""}`}>
                      <span className="absolute start-4 top-3">{course.enrollment_status ? <EnrollmentBadge status={course.enrollment_status} /> : <span className="rounded-pill bg-surface/75 px-2.5 py-1 text-xs font-semibold text-ink-secondary">{course.is_published ? "متاحة للاشتراك" : "مسوّدة"}</span>}</span>
                      <LibraryIcon name="book" className="absolute bottom-4 end-4 h-16 w-16 -rotate-12 opacity-20" />
                      <span className="absolute bottom-3 start-4 inline-flex rounded-card bg-surface/60 p-1"><CourseCover courseId={course.id} title={course.title} size={40} /></span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col p-5">
                      <Link to={`/courses/${course.id}`} className="text-lg font-bold leading-relaxed text-ink hover:text-accent">{course.title}</Link>
                      <p className="mt-1 text-xs text-ink-muted">مع {teacherName}</p>
                      <p className="mb-5 mt-4 line-clamp-3 text-sm leading-relaxed text-ink-secondary">{course.description || "استكشف محتوى الدورة وتعرّف على تفاصيلها قبل أن تبدأ."}</p>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><div><p className="mb-1 text-xs text-ink-muted">رسوم الدورة</p><PriceTag price={course.price} className="text-base" /></div><Link to={`/courses/${course.id}`} className="inline-flex items-center gap-2 text-xs font-semibold text-accent hover:underline">التفاصيل<LibraryIcon name="arrow" className="h-4 w-4" /></Link></div>
                      <Link to={!isTeacher && course.enrollment_status === "active" ? `/courses/${course.id}/lessons/l1` : !isTeacher && course.enrollment_status === "pending_payment" ? "/my-enrollments" : `/courses/${course.id}`} className="mt-4 flex min-h-10 items-center justify-center gap-2 rounded-control bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast hover:opacity-90">{!isTeacher && course.enrollment_status === "active" ? "افتح الدروس" : !isTeacher && course.enrollment_status === "pending_payment" ? "متابعة التسجيل" : "استكشف الدورة"}<LibraryIcon name="arrow" className="h-4 w-4" /></Link>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-line bg-section p-5">
            <div><p className="text-sm font-bold text-ink">اختر خطوتك التالية.</p><p className="mt-1 text-xs leading-relaxed text-ink-secondary">استعرض الدورات المجانية، أو راجع تسجيلاتك لاستكمال خطوتك التالية.</p></div>
            <Button variant="secondary" onClick={() => { const next = new URLSearchParams(); if (courses.some((course) => Number(course.price) === 0)) next.set("filter", "free"); setParams(next); }}>{courses.some((course) => Number(course.price) === 0) ? "استعرض الدورات المجانية" : "استعرض كل الدورات"}<LibraryIcon name="arrow" className="h-4 w-4" /></Button>
          </div>
        </>
      )}
    </div>
  );
}
