import { useCallback, useEffect, useRef, useState } from "react";

import { approveStudent, listAllWorkspaceStudents, rejectStudent } from "../../../api/studentReview";
import { Alert, ApprovalBadge, Button, Card, EmptyState, FullPageSpinner, Input, Label, PageHeader, PaginationControls, Select, Spinner, Textarea } from "../../../components/ui";
import { useSession } from "../../../context/SessionContext";
import { useApiErrorText } from "../../../lib/apiErrorText";
import { ApiError } from "../../../lib/apiClient";
import { formatDate } from "../../../lib/format";
import type { ApprovalStatus, StudentReviewEntry } from "../../../types/api";

const PAGE_SIZE = 20;
const FILTERS = [
  { value: "pending", label: "طلبات الانتظار", hint: "تحتاج إلى مراجعتك" },
  { value: "approved", label: "طلاب مقبولون", hint: "تم قبول انضمامهم للمساحة" },
  { value: "rejected", label: "طلبات مرفوضة", hint: "مع الاحتفاظ بسبب القرار" },
] as const;
type StatusFilter = ApprovalStatus | "all";
type Decision = { student: StudentReviewEntry; action: "approve" | "reject" };
const digits = (n: number) => n.toLocaleString("ar");
const normalize = (value: string) => value.toLocaleLowerCase("ar").normalize("NFKD").replace(/[\u064b-\u065f\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").trim();

function StudentIcon({ name }: { name: "users" | "clock" | "check" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden>
      {name === "users" && <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5" /></>}
      {name === "clock" && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
    </svg>
  );
}

export default function StudentsReviewPage() {
  const { slug } = useSession();
  return <StudentsWorkspace key={slug} slug={slug ?? ""} />;
}
export { StudentsReviewPage };

function StudentsWorkspace({ slug }: { slug: string }) {
  const { publicProfile, workspace } = useSession();
  const errorToText = useApiErrorText();
  const [rows, setRows] = useState<StudentReviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("oldest");
  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notice, setNotice] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const students = await listAllWorkspaceStudents(slug);
      if (request === requestRef.current) setRows(students);
    } catch (caught) {
      if (request === requestRef.current) setError(errorToText(caught as ApiError, "تعذّر تحميل الطلاب."));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [slug, errorToText]);

  useEffect(() => {
    void load();
    return () => { requestRef.current += 1; };
  }, [load]);

  const term = normalize(query);
  const matches = rows.filter((student) => (status === "all" || student.approval_status === status) &&
    normalize(`${student.full_name} ${student.email} ${student.phone ?? ""}`).includes(term));
  matches.sort((a, b) => sort === "name" ? a.full_name.localeCompare(b.full_name, "ar") :
    sort === "newest" ? Date.parse(b.date_joined) - Date.parse(a.date_joined) : Date.parse(a.date_joined) - Date.parse(b.date_joined));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(matches.length / PAGE_SIZE)));
  const visible = matches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function selectStatus(value: StatusFilter) { setStatus(value); setPage(1); }
  function openDecision(student: StudentReviewEntry, action: Decision["action"], opener: HTMLElement) {
    openerRef.current = opener;
    setDecision({ student, action });
  }
  function restoreFocus() {
    requestAnimationFrame(() => {
      if (openerRef.current?.isConnected) openerRef.current.focus();
      else resultsRef.current?.focus();
    });
  }
  function closeDecision() { setDecision(null); restoreFocus(); }
  function reviewed(student: StudentReviewEntry) {
    setRows((current) => current.map((item) => item.id === student.id ? student : item));
    setNotice(`${student.approval_status === "approved" ? "تم قبول طلب" : "تم رفض طلب"} ${student.full_name}.`);
    closeDecision();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-line bg-section p-6 sm:p-8" aria-label="إدارة طلاب المساحة">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-accent"><StudentIcon name="users" />مساحة {publicProfile?.teacher_name || workspace?.name || "المعلّم"}</div>
        <div className="[&_h1]:text-3xl [&_h1]:font-extrabold"><PageHeader title="إدارة الطلاب" subtitle="راجع طلبات الانضمام، وتعرّف على طلاب مساحتك، واتّخذ كل قرار بوضوح." /></div>
        <div className="text-sm leading-8 text-ink">قبول الطالب يسمح له بالدخول إلى المساحة، ولا يفعّل اشتراكه في الدورات المدفوعة تلقائيًا.</div>
      </section>

      <div role="status" aria-live="polite" className={notice ? "rounded-card border border-line bg-accent-soft p-4 font-medium text-ink" : "sr-only"}>{notice}</div>
      {loading ? <FullPageSpinner /> : error ? (
        <Card><Alert tone="error">{error}</Alert><Button variant="secondary" className="mt-4" onClick={() => void load()}>إعادة المحاولة</Button></Card>
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-3">
            {FILTERS.map((item) => <Card key={item.value}><dt className="text-sm font-bold text-ink">{item.label}</dt><dd className="mt-3 text-3xl font-extrabold text-accent">{digits(rows.filter((student) => student.approval_status === item.value).length)}</dd><div className="mt-2 text-sm text-ink">{item.hint}</div></Card>)}
          </dl>
          <div className="grid items-start gap-6 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <Card className="space-y-5 p-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Label htmlFor="student-search">ابحث عن طالب</Label>
                    <Input id="student-search" type="search" className="min-h-12" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="الاسم أو البريد أو رقم الهاتف" aria-describedby="student-search-hint" />
                    <div id="student-search-hint" className="mt-2 text-sm text-ink">البحث يشمل جميع الطلاب في الحالة المختارة.</div>
                  </div>
                  <div><Label htmlFor="student-sort">ترتيب العرض</Label><Select id="student-sort" className="min-h-12" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="oldest">الأقدم تسجيلًا أولًا</option><option value="newest">الأحدث تسجيلًا أولًا</option><option value="name">حسب الاسم</option></Select></div>
                </div>
                <div className="flex flex-wrap gap-2" aria-label="حالة الطلاب">
                  {[{ value: "all" as const, label: "كل الطلاب" }, ...FILTERS].map((item) => <Button key={item.value} variant={status === item.value ? "primary" : "secondary"} className="min-h-11" aria-pressed={status === item.value} onClick={() => selectStatus(item.value)}>{item.label}</Button>)}
                </div>
              </Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div ref={resultsRef} tabIndex={-1} className="rounded-control text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent" role="status">{digits(matches.length)} نتيجة من {digits(rows.length)} طالب في المساحة</div>
                <Button variant="ghost" className="min-h-11" onClick={() => { setNotice(""); void load(); }}>تحديث القائمة</Button>
              </div>
              {visible.length === 0 ? <Card><EmptyState title={rows.length === 0 ? "لا يوجد طلاب في مساحتك بعد" : term ? "لا توجد نتائج مطابقة" : "لا توجد طلبات بهذه الحالة"} hint={term ? "جرّب جزءًا من الاسم أو البريد، أو غيّر الحالة المختارة." : status === "pending" ? "ستظهر طلبات الانضمام الجديدة هنا لمراجعتها." : "يمكنك اختيار حالة أخرى لعرض الطلاب."} />{rows.length > 0 && <Button className="mt-4" variant="secondary" onClick={() => { setQuery(""); selectStatus("all"); }}>عرض كل الطلاب</Button>}</Card> : (
                <ul className="space-y-4">
                  {visible.map((student) => <li key={student.id}><Card className="p-6">
                    <div className="flex flex-wrap items-start gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl font-bold text-accent" aria-hidden>{student.full_name.trim().charAt(0) || "ط"}</span>
                      <div className="min-w-0 flex-1 basis-40"><div role="heading" aria-level={2} className="text-lg font-bold text-ink">{student.full_name}</div><div dir="ltr" className="mt-1 break-all text-start text-sm leading-7 text-ink">{student.email}</div><div className="mt-1 text-sm text-ink">{student.phone ? <span dir="ltr">{student.phone}</span> : "لم يُضف رقم هاتف"}</div></div>
                      <ApprovalBadge status={student.approval_status} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-sm leading-7 text-ink"><span>تاريخ التسجيل: {formatDate(student.date_joined)}</span>{student.reviewed_at && <span>تاريخ المراجعة: {formatDate(student.reviewed_at)}</span>}</div>
                    {student.approval_status === "rejected" && student.rejection_reason && <div className="mt-4 rounded-card bg-soft p-4 text-sm leading-8 text-ink"><span className="font-bold">سبب الرفض: </span>{student.rejection_reason}</div>}
                    {student.approval_status === "pending" && <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm text-ink"><StudentIcon name="clock" />بانتظار قرارك</div><div className="flex gap-2"><Button className="min-h-11" onClick={(event) => openDecision(student, "approve", event.currentTarget)}><StudentIcon name="check" />قبول الطلب</Button><Button variant="secondary" className="min-h-11" onClick={(event) => openDecision(student, "reject", event.currentTarget)}>رفض الطلب</Button></div></div>}
                  </Card></li>)}
                </ul>
              )}
              {matches.length > PAGE_SIZE && <PaginationControls page={currentPage} count={matches.length} pageSize={PAGE_SIZE} hasPrevious={currentPage > 1} hasNext={currentPage * PAGE_SIZE < matches.length} onPrevious={() => { setPage(currentPage - 1); resultsRef.current?.focus(); }} onNext={() => { setPage(currentPage + 1); resultsRef.current?.focus(); }} />}
            </div>
            <aside className="space-y-5" aria-label="إرشادات مراجعة الطلاب">
              <section className="rounded-panel bg-panel p-6 text-panel-fg"><div role="heading" aria-level={2} className="text-xl font-bold">قرار واضح لكل طلب</div><ol className="mt-5 space-y-5">{[["راجع بيانات الطالب", "تأكّد من الاسم والبريد وبيانات التواصل المتاحة."], ["حدّد قرارك", "القبول للانضمام إلى المساحة، والرفض يحتاج سببًا واضحًا."], ["راجع قبل التأكيد", "تظهر لك بيانات الطالب وتأثير القرار في نافذة التأكيد."]].map(([title, hint], index) => <li key={title} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current text-sm">{digits(index + 1)}</span><div><div className="font-bold">{title}</div><div className="mt-1 text-sm leading-8">{hint}</div></div></li>)}</ol></section>
              <Card><div role="heading" aria-level={2} className="text-lg font-bold text-ink">القبول ليس تأكيد دفع</div><div className="mt-3 text-sm leading-8 text-ink">مراجعة طلب الانضمام منفصلة عن اشتراكات الدورات وإشعارات الدفع. لا تستنتج من قبول الطالب أنه مسجّل في كل الدورات.</div></Card>
              <Card><div role="heading" aria-level={2} className="text-lg font-bold text-ink">اكتب سببًا يساعد الطالب</div><div className="mt-3 text-sm leading-8 text-ink">سبب الرفض يظهر للطالب عند محاولة الدخول. اكتبه باحترام وبشكل محدّد، دون معلومات حسّاسة. لا تتوفّر هنا إعادة مراجعة الطلب بعد اتخاذ القرار.</div></Card>
            </aside>
          </div>
        </>
      )}
      {decision && <ReviewDecision key={`${decision.student.id}:${decision.action}`} decision={decision} slug={slug} onClose={closeDecision} onReviewed={reviewed} />}
    </div>
  );
}

function ReviewDecision({ decision, slug, onClose, onReviewed }: { decision: Decision; slug: string; onClose: () => void; onReviewed: (student: StudentReviewEntry) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorToText = useApiErrorText();
  const reject = decision.action === "reject";

  useEffect(() => { dialogRef.current?.showModal(); }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current || (reject && !reason.trim())) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      const updated = reject ? await rejectStudent(slug, decision.student.id, reason.trim()) : await approveStudent(slug, decision.student.id);
      onReviewed(updated);
    } catch (caught) {
      const apiError = caught as ApiError;
      setError(apiError.status === 409 ? "تمت مراجعة هذا الطلب بالفعل. أغلق النافذة واضغط «تحديث القائمة» للحصول على الحالة الحالية؛ لا تكرّر القرار." : errorToText(apiError, "تعذّر حفظ القرار. لم تُفقد بياناتك؛ حاول مرة أخرى."));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="student-decision-title" aria-describedby="student-decision-hint" onCancel={(event) => { event.preventDefault(); if (!sending.current) onClose(); }} className="m-auto max-h-dvh w-full max-w-lg overflow-y-auto rounded-panel border border-line bg-surface p-6 text-ink shadow-elevated backdrop:bg-panel/50 sm:p-8">
      <div id="student-decision-title" role="heading" aria-level={2} className="text-xl font-extrabold">{reject ? "تأكيد رفض طلب الانضمام" : "تأكيد قبول طلب الانضمام"}</div>
      <div className="my-5 rounded-card bg-soft p-4"><div className="font-bold">{decision.student.full_name}</div><div dir="ltr" className="mt-1 break-all text-start text-sm">{decision.student.email}</div></div>
      <div id="student-decision-hint" className="text-sm leading-8">{reject ? "سيظهر سبب الرفض للطالب عند محاولة الدخول. يبقى الحساب محفوظًا، ولا يمكن إنشاء حساب آخر بنفس البريد داخل المساحة." : "سيتمكّن الطالب من الدخول إلى مساحتك بعد القبول. الدورات المدفوعة تحتاج تسجيلًا وتأكيد دفع مستقلّين."} لا يمكن إعادة مراجعة هذا الطلب من هذه الصفحة بعد تأكيد القرار.</div>
      <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-5" aria-busy={busy}>
        {error && <Alert tone="error">{error}</Alert>}
        {reject && <div><Label htmlFor="student-rejection-reason">سبب الرفض (مطلوب، يظهر للطالب)</Label><Textarea id="student-rejection-reason" rows={4} required maxLength={1000} disabled={busy} value={reason} onChange={(event) => setReason(event.target.value)} aria-describedby="student-reason-count" placeholder="وضّح سبب القرار باحترام وبشكل محدّد" /><div id="student-reason-count" className="mt-2 text-sm">{digits(reason.length)} / {digits(1000)} حرف</div></div>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" size="lg" autoFocus disabled={busy} onClick={onClose}>إلغاء والعودة</Button>
          <Button type="submit" variant={reject ? "danger" : "primary"} size="lg" disabled={busy || (reject && !reason.trim())}>{busy && <Spinner className="h-4 w-4" />}{busy ? "جارٍ حفظ القرار..." : reject ? "تأكيد الرفض" : "تأكيد القبول"}</Button>
        </div>
      </form>
    </dialog>
  );
}
