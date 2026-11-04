import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { createCourse, listCourses, updateCourse } from "../../../api/courses";
import { Alert, Button, Card, CourseCover, EmptyState, FieldError, FullPageSpinner, Input, Label, PageHeader, PriceTag, Select, Spinner, Textarea } from "../../../components/ui";
import { useSession } from "../../../context/SessionContext";
import { useApiErrorText } from "../../../lib/apiErrorText";
import { ApiError } from "../../../lib/apiClient";
import { formatDate } from "../../../lib/format";
import type { Course } from "../../../types/api";

type CourseFilter = "all" | "published" | "draft";
type Modal = { type: "edit"; course: Course | null } | { type: "publish"; course: Course };
const digits = (n: number) => n.toLocaleString("ar");
const normalize = (value: string) => value.toLocaleLowerCase("ar").normalize("NFKD").replace(/[\u064b-\u065f\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").trim();
const dialogClass = "m-auto max-h-dvh w-full max-w-xl overflow-y-auto rounded-panel border border-line bg-surface p-6 text-ink shadow-elevated backdrop:bg-panel/50 sm:p-8";

function CourseIcon({ name }: { name: "book" | "plus" | "arrow" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden>
      {name === "book" && <><path d="M3 4c3-1 6 0 9 2v15c-3-2-6-3-9-2V4Z" /><path d="M12 6c3-2 6-3 9-2v15c-3-1-6 0-9 2" /></>}
      {name === "plus" && <path d="M12 5v14M5 12h14" />}
      {name === "arrow" && <path d="M20 12H4m7-7-7 7 7 7" />}
    </svg>
  );
}

export default function TeacherCoursesPage() {
  const { slug } = useSession();
  return <CourseWorkspace key={slug} slug={slug ?? ""} />;
}
export { TeacherCoursesPage };

function CourseWorkspace({ slug }: { slug: string }) {
  const { publicProfile, workspace } = useSession();
  const errorToText = useApiErrorText();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<CourseFilter>("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [modal, setModal] = useState<Modal | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await listCourses(slug);
      if (request === requestRef.current) setCourses(response);
    } catch (caught) {
      if (request === requestRef.current) setError(errorToText(caught as ApiError, "تعذّر تحميل دوراتك."));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [slug, errorToText]);
  useEffect(() => {
    void load();
    return () => { requestRef.current += 1; };
  }, [load]);

  const published = courses.filter((course) => course.is_published).length;
  const missingDescriptions = courses.filter((course) => !course.description?.trim()).length;
  const term = normalize(query);
  const visible = courses.filter((course) =>
    (filter === "all" || (filter === "published" ? course.is_published : !course.is_published)) &&
    (priceFilter === "all" || (priceFilter === "free" ? Number(course.price) === 0 : Number(course.price) > 0)) &&
    normalize(`${course.title} ${course.description ?? ""}`).includes(term));
  visible.sort((a, b) => sort === "name" ? a.title.localeCompare(b.title, "ar") : sort === "oldest" ? Date.parse(a.created_at) - Date.parse(b.created_at) : Date.parse(b.created_at) - Date.parse(a.created_at));

  function openModal(next: Modal, element: HTMLElement) {
    opener.current = element;
    setModal(next);
  }
  function closeModal() {
    setModal(null);
    requestAnimationFrame(() => {
      if (opener.current?.isConnected) opener.current.focus();
      else resultsRef.current?.focus();
    });
  }
  function saved(course: Course, message: string, created = false) {
    setCourses((current) => created ? [course, ...current] : current.map((item) => item.id === course.id ? course : item));
    if (created) { setFilter("all"); setPriceFilter("all"); setQuery(""); setSort("newest"); }
    setNotice(message);
    closeModal();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-line bg-section p-6 sm:p-8" aria-label="إدارة دورات المساحة">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-accent"><CourseIcon name="book" />مساحة {publicProfile?.teacher_name || workspace?.name || "المعلّم"}</div>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="[&_h1]:text-3xl [&_h1]:font-extrabold"><PageHeader title="إدارة الدورات" subtitle="ابدأ بمسوّدة، رتّب محتواها، ثم انشرها عندما تصبح جاهزة." /></div>
          <Button size="lg" onClick={(event) => openModal({ type: "edit", course: null }, event.currentTarget)}><CourseIcon name="plus" />إنشاء دورة جديدة</Button>
        </div>
        <div className="text-sm leading-8 text-ink">بيانات الدورة ومحتواها وخيارات نشرها، بخطوات منفصلة وواضحة.</div>
      </section>
      <div role="status" aria-live="polite" className={notice ? "rounded-card border border-line bg-accent-soft p-4 text-ink" : "sr-only"}>{notice}</div>

      {loading ? <FullPageSpinner /> : error ? <Card><Alert tone="error">{error}</Alert><Button variant="secondary" className="mt-4" onClick={() => void load()}>إعادة المحاولة</Button></Card> : (
        <>
          <dl className="grid gap-4 sm:grid-cols-3">
            {[[courses.length, "إجمالي الدورات", "كل دورات مساحتك"], [published, "دورات منشورة", "ظاهرة في قائمة دورات الطلاب"], [courses.length - published, "مسوّدات", "غير ظاهرة في قائمة الطلاب"]].map(([value, title, hint]) => <Card key={title}><dt className="text-sm font-bold text-ink">{title}</dt><dd className="mt-3 text-3xl font-extrabold text-accent">{digits(Number(value))}</dd><div className="mt-2 text-sm text-ink">{hint}</div></Card>)}
          </dl>
          <div className="grid items-start gap-6 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <Card className="space-y-5 p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Label htmlFor="course-search">ابحث في دوراتك</Label><Input id="course-search" type="search" className="min-h-12" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="عنوان الدورة أو جزء من وصفها" /></div>
                  <div><Label htmlFor="course-price-filter">نوع الدورة</Label><Select id="course-price-filter" className="min-h-12" value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)}><option value="all">مجانية وبمقابل</option><option value="free">مجانية فقط</option><option value="paid">بمقابل فقط</option></Select></div>
                  <div><Label htmlFor="course-sort">ترتيب العرض</Label><Select id="course-sort" className="min-h-12" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">الأحدث إنشاءً</option><option value="oldest">الأقدم إنشاءً</option><option value="name">حسب العنوان</option></Select></div>
                </div>
                <div className="flex flex-wrap gap-2" aria-label="حالة نشر الدورة">
                  {([{ value: "all", label: "كل الدورات" }, { value: "published", label: "منشورة" }, { value: "draft", label: "مسوّدات" }] as const).map((item) => <Button key={item.value} variant={filter === item.value ? "primary" : "secondary"} className="min-h-11" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</Button>)}
                </div>
              </Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div ref={resultsRef} tabIndex={-1} role="status" className="rounded-control text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent">{digits(visible.length)} دورات من أصل {digits(courses.length)}</div>
                <Button variant="ghost" className="min-h-11" onClick={() => { setNotice(""); void load(); }}>تحديث القائمة</Button>
              </div>
              {visible.length === 0 ? <Card><EmptyState title={courses.length === 0 ? "دورتك الأولى تبدأ من هنا" : "لا توجد دورات مطابقة"} hint={courses.length === 0 ? "أنشئ مسوّدة ببياناتها الأساسية، ثم أضف المحتوى قبل النشر." : "جرّب عنوانًا آخر أو أزل فلاتر العرض."} />{courses.length === 0 ? <Button className="mt-4" onClick={(event) => openModal({ type: "edit", course: null }, event.currentTarget)}>إنشاء أول مسوّدة</Button> : <Button variant="secondary" className="mt-4" onClick={() => { setQuery(""); setFilter("all"); setPriceFilter("all"); }}>إزالة البحث والفلاتر</Button>}</Card> : (
                <ul className="space-y-5">
                  {visible.map((course) => <li key={course.id}><Card className="p-6">
                    <div className="flex flex-wrap items-start gap-4">
                      <CourseCover courseId={course.id} title={course.title} />
                      <div className="min-w-0 flex-1 basis-40"><div role="heading" aria-level={2} className="text-lg font-bold leading-8 text-ink">{course.title}</div><div className="mt-1 text-sm leading-7 text-ink">أُنشئت {formatDate(course.created_at)}</div></div>
                      <span className={`rounded-pill px-3 py-1 text-sm font-bold ${course.is_published ? "bg-accent-soft text-accent" : "border border-line bg-soft text-ink"}`}>{course.is_published ? "منشورة" : "مسوّدة"}</span>
                    </div>
                    <div className="mt-4 line-clamp-3 whitespace-pre-line text-sm leading-8 text-ink">{course.description || "لم تضف وصفًا بعد. وضّح للطالب ما الذي سيتعلّمه ولمن تناسب هذه الدورة."}</div>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                      <PriceTag price={course.price} className="text-xl" />
                      <span className="text-sm text-ink">{course.is_published ? "ظاهرة في قائمة الطلاب" : "غير ظاهرة في قائمة الطلاب"}</span>
                    </div>
                    {!course.description?.trim() && <div className="mt-4 rounded-control bg-soft px-4 py-3 text-sm leading-7 text-ink">تحتاج إلى وصف · يساعد الطالب على اتخاذ قرار الاشتراك.</div>}
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link to={`/teacher/courses/${course.id}/content`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-accent px-4 py-3 text-sm font-bold text-accent-contrast hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">إدارة المحتوى<CourseIcon name="arrow" /></Link>
                      <Button variant="secondary" size="lg" onClick={(event) => openModal({ type: "edit", course }, event.currentTarget)}>تعديل البيانات</Button>
                      <Button variant="ghost" size="lg" onClick={(event) => openModal({ type: "publish", course }, event.currentTarget)}>{course.is_published ? "إلغاء النشر" : "مراجعة ونشر"}</Button>
                    </div>
                  </Card></li>)}
                </ul>
              )}
            </div>
            <aside className="space-y-5" aria-label="إرشادات إدارة الدورات">
              <section className="rounded-panel bg-panel p-6 text-panel-fg"><div role="heading" aria-level={2} className="text-xl font-bold">من فكرة إلى دورة واضحة</div><ol className="mt-5 space-y-5">{[["ابدأ بالبيانات الأساسية", "عنوان محدّد، وصف مفيد، وسعر واضح. تُحفظ الدورة الجديدة كمسوّدة."], ["جهّز محتوى التعلّم", "راجع الوحدات والدروس والملفات من إدارة المحتوى."], ["راجع ثم انشر", "النشر قرار منفصل، وليس نتيجة تلقائية لحفظ البيانات."]].map(([title, hint], index) => <li key={title} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current text-sm">{digits(index + 1)}</span><div><div className="font-bold">{title}</div><div className="mt-1 text-sm leading-8">{hint}</div></div></li>)}</ol></section>
              <Card><div role="heading" aria-level={2} className="text-lg font-bold text-ink">وضوح الوصف قبل كثرة التفاصيل</div><div className="mt-3 text-sm leading-8 text-ink">{missingDescriptions ? `${digits(missingDescriptions)} دورات بدون وصف. ` : "كل دوراتك تحتوي على وصف. "}اذكر الهدف والمستوى المناسب والمتطلّبات السابقة إن وجدت. وجود الوصف وحده لا يعني اكتمال المحتوى.</div></Card>
            </aside>
          </div>
        </>
      )}
      {modal?.type === "edit" && <CourseEditor course={modal.course} slug={slug} onClose={closeModal} onSaved={saved} />}
      {modal?.type === "publish" && <PublishDecision course={modal.course} slug={slug} onClose={closeModal} onSaved={saved} />}
    </div>
  );
}

function CourseEditor({ course, slug, onClose, onSaved }: { course: Course | null; slug: string; onClose: () => void; onSaved: (course: Course, message: string, created?: boolean) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const guard = useRef(false);
  const errorToText = useApiErrorText();
  const [title, setTitle] = useState(course?.title ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [price, setPrice] = useState(course?.price ?? "");
  const [busy, setBusy] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const dirty = title !== (course?.title ?? "") || description !== (course?.description ?? "") || price !== (course?.price ?? "");
  const discardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { dialogRef.current?.showModal(); }, []);
  useEffect(() => { if (discarding) discardRef.current?.focus(); }, [discarding]);
  function requestClose() {
    if (guard.current) return;
    if (dirty) setDiscarding(true);
    else onClose();
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (guard.current) return;
    const invalid: Record<string, string[]> = {};
    if (!title.trim()) invalid.title = ["اكتب عنوانًا واضحًا للدورة، وليس مسافات فقط."];
    if (!/^\d+(?:\.\d{1,2})?$/.test(price) || !Number.isFinite(Number(price))) invalid.price = ["اكتب سعرًا غير سالب بخانتين عشريتين بحد أقصى. استخدم 0 للدورة المجانية."];
    setFields(invalid);
    if (Object.keys(invalid).length) { setError("راجع الحقول الموضّحة قبل الحفظ."); return; }
    guard.current = true;
    setBusy(true);
    setError(null);
    try {
      const data = { title: title.trim(), description: description.trim() || null, price: Number(price).toFixed(2), is_published: course?.is_published ?? false };
      const result = course ? await updateCourse(slug, course.id, data) : await createCourse(slug, data);
      onSaved(result, course ? `تم حفظ بيانات «${result.title}» دون تغيير حالة النشر.` : `تم إنشاء «${result.title}» كمسوّدة. يمكنك الآن إضافة المحتوى.`, !course);
    } catch (caught) {
      const apiError = caught as ApiError;
      setFields(apiError.fieldErrors ?? {});
      setError(errorToText(apiError, "تعذّر حفظ الدورة. تعديلاتك ما زالت موجودة."));
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog ref={dialogRef} className={dialogClass} aria-labelledby="course-editor-title" aria-describedby="course-editor-hint" onCancel={(event) => { event.preventDefault(); requestClose(); }}>
      <div id="course-editor-title" role="heading" aria-level={2} className="text-2xl font-extrabold">{course ? "تعديل بيانات الدورة" : "إنشاء مسوّدة جديدة"}</div>
      <div id="course-editor-hint" className="mt-3 text-sm leading-8">{course ? "تعديل البيانات لا يغيّر حالة النشر. راجع السعر والوصف بعناية، خاصةً إذا كانت الدورة منشورة." : "ابدأ بالبيانات الأساسية. لن تظهر الدورة للطلاب قبل نشرها في خطوة منفصلة."}</div>
      {discarding ? <div ref={discardRef} tabIndex={-1} className="mt-6 rounded-card border border-line bg-soft p-5 focus-visible:outline-accent"><div role="heading" aria-level={3} className="font-bold">تجاهل التعديلات غير المحفوظة؟</div><div className="mt-2 text-sm leading-8">لم يتم حفظ هذه التغييرات. يمكنك العودة لإكمالها أو إغلاق النموذج دون حفظ.</div><div className="mt-4 flex flex-wrap gap-3"><Button variant="secondary" size="lg" onClick={() => setDiscarding(false)}>العودة للتعديل</Button><Button variant="danger" size="lg" onClick={onClose}>تجاهل وإغلاق</Button></div></div> : (
        <form className="mt-6 space-y-5" onSubmit={(event) => void submit(event)} aria-busy={busy}>
          {error && <Alert tone="error">{error}</Alert>}
          <fieldset disabled={busy} className="min-w-0 space-y-5">
            <div><Label htmlFor="course-title">عنوان الدورة (مطلوب)</Label><Input id="course-title" className="min-h-12" required autoFocus value={title} onChange={(event) => setTitle(event.target.value)} invalid={Boolean(fields.title)} aria-describedby={fields.title ? "course-title-error" : undefined} /><FieldError id="course-title-error" messages={fields.title} /></div>
            <div><Label htmlFor="course-description">وصف الدورة (اختياري)</Label><Textarea id="course-description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="ماذا سيتعلّم الطالب؟ ولمن تناسب هذه الدورة؟" invalid={Boolean(fields.description)} aria-describedby="course-description-hint course-description-error" /><div id="course-description-hint" className="mt-2 text-sm leading-7">الوصف الجيد يوضّح الهدف والمستوى والمتطلّبات، دون وعود غير مؤكّدة.</div><FieldError id="course-description-error" messages={fields.description} /></div>
            <div><Label htmlFor="course-price">السعر (مطلوب)</Label><Input id="course-price" className="min-h-12" type="number" dir="ltr" required min="0" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" invalid={Boolean(fields.price)} aria-describedby="course-price-hint course-price-error" /><div id="course-price-hint" className="mt-2 text-sm leading-7">اكتب 0 للدورة المجانية. عرض السعر بنفس عملة المنصّة المستخدمة في قائمة الدورات.</div><FieldError id="course-price-error" messages={fields.price} /></div>
            {price !== "" && Number.isFinite(Number(price)) && Number(price) >= 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-soft p-4 text-sm"><span>السعر الذي سيظهر في الدورة</span><PriceTag price={price} className="text-xl" /></div>}
            <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="secondary" size="lg" disabled={busy} onClick={requestClose}>إلغاء</Button><Button type="submit" size="lg" disabled={busy}>{busy && <Spinner className="h-4 w-4 border-accent-contrast/40 border-t-accent-contrast" />}{busy ? "جارٍ الحفظ..." : course ? "حفظ التعديلات" : "إنشاء كمسوّدة"}</Button></div>
          </fieldset>
        </form>
      )}
    </dialog>
  );
}

function PublishDecision({ course, slug, onClose, onSaved }: { course: Course; slug: string; onClose: () => void; onSaved: (course: Course, message: string) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const guard = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorToText = useApiErrorText();
  useEffect(() => { dialogRef.current?.showModal(); }, []);
  async function confirm() {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await updateCourse(slug, course.id, { is_published: !course.is_published });
      onSaved(result, result.is_published ? `تم نشر «${result.title}».` : `تم إلغاء نشر «${result.title}» وتحويلها إلى مسوّدة.`);
    } catch (caught) {
      setError(errorToText(caught as ApiError, "تعذّر تغيير حالة النشر. حاول مرة أخرى."));
    } finally { guard.current = false; setBusy(false); }
  }
  return (
    <dialog ref={dialogRef} className={dialogClass} aria-labelledby="course-publish-title" aria-describedby="course-publish-hint" onCancel={(event) => { event.preventDefault(); if (!guard.current) onClose(); }}>
      <div id="course-publish-title" role="heading" aria-level={2} className="text-2xl font-extrabold">{course.is_published ? "إلغاء نشر الدورة؟" : "هل الدورة جاهزة للنشر؟"}</div>
      <div className="my-5 flex items-start gap-4 rounded-card bg-soft p-4"><CourseCover courseId={course.id} title={course.title} /><div className="min-w-0"><div className="font-bold leading-8">{course.title}</div><PriceTag price={course.price} /></div></div>
      <div id="course-publish-hint" className="text-sm leading-8">{course.is_published ? "ستتحوّل الدورة إلى مسوّدة ولن تظهر في قائمة دورات الطلاب. هذا الإجراء ليس حذفًا للدورة ولا إلغاءً لاشتراكات الطلاب." : "ستظهر الدورة في قائمة الطلاب. راجع المحتوى والملفات والسعر قبل التأكيد؛ هذه النافذة لا تتحقّق تلقائيًا من اكتمال الدروس."}</div>
      {!course.is_published && !course.description?.trim() && <div className="mt-4 rounded-card border border-line bg-soft p-4 text-sm leading-8">لم تضف وصفًا لهذه الدورة. يفضّل الرجوع لتعديل البيانات حتى يعرف الطالب ما الذي يشترك فيه.</div>}
      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}
      <div className="mt-6 flex flex-wrap justify-end gap-3"><Button variant="secondary" size="lg" autoFocus disabled={busy} onClick={onClose}>العودة للمراجعة</Button><Button size="lg" variant={course.is_published ? "secondary" : "primary"} disabled={busy} onClick={() => void confirm()}>{busy && <Spinner className="h-4 w-4" />}{busy ? "جارٍ الحفظ..." : course.is_published ? "تأكيد إلغاء النشر" : "تأكيد النشر"}</Button></div>
    </dialog>
  );
}
