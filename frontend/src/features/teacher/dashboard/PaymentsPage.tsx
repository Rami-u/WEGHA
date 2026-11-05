import { useCallback, useEffect, useRef, useState } from "react";

import { confirmPayment, listAllPayments, paymentReceiptUrl, rejectPayment } from "../../../api/payments";
import { Alert, Button, Card, EmptyState, FullPageSpinner, Input, Label, PageHeader, PaginationControls, PaymentBadge, Select, Spinner, Textarea } from "../../../components/ui";
import { useSession } from "../../../context/SessionContext";
import { useApiErrorText } from "../../../lib/apiErrorText";
import { ApiError } from "../../../lib/apiClient";
import { formatDate, formatPrice } from "../../../lib/format";
import type { PaymentStatus, PaymentSubmission } from "../../../types/api";

const PAGE_SIZE = 20;
const FILTERS = [
  { value: "submitted", label: "بانتظار المراجعة", hint: "إشعارات تحتاج قرارك" },
  { value: "confirmed", label: "مؤكّدة", hint: "تم تأكيدها داخل المنصّة" },
  { value: "rejected", label: "مرفوضة", hint: "مع توضيح سبب القرار" },
] as const;
const METHODS: Record<string, string> = { transfer: "تحويل بنكي", e_wallet: "محفظة إلكترونية", cash: "نقدي", other: "أخرى" };
const digits = (n: number) => n.toLocaleString("ar");
const normalize = (value: string) => value.toLocaleLowerCase("ar").normalize("NFKD").replace(/[\u064b-\u065f\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").trim();
type Decision = { claim: PaymentSubmission; action: "confirm" | "reject" };

function ReviewIcon({ name }: { name: "receipt" | "check" | "clock" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden>
      {name === "receipt" && <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></>}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "clock" && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
    </svg>
  );
}

function ReceiptAction({ claim, slug }: { claim: PaymentSubmission; slug: string }) {
  return claim.has_receipt ? (
    <div><Button variant="secondary" className="min-h-11" onClick={() => window.open(paymentReceiptUrl(slug, claim.id), "_blank", "noopener,noreferrer")}><ReviewIcon name="receipt" />فتح الإيصال</Button><div className="mt-1 text-sm text-ink">يفتح في تبويب جديد أو يُنزّل حسب نوع الملف.</div></div>
  ) : <div className="text-sm leading-7 text-ink">لم يُرفق إيصال. طابق الدفعة من وسيلة الدفع المتّفق عليها؛ غياب المرفق ليس سببًا تلقائيًا للرفض.</div>;
}

export default function PaymentsReviewPage() {
  const { slug } = useSession();
  return <PaymentsWorkspace key={slug} slug={slug ?? ""} />;
}
export { PaymentsReviewPage };

function PaymentsWorkspace({ slug }: { slug: string }) {
  const { publicProfile, workspace } = useSession();
  const errorToText = useApiErrorText();
  const [rows, setRows] = useState<PaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState<PaymentStatus | "all">("submitted");
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("all");
  const [sort, setSort] = useState("oldest");
  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState<Decision | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const payments = await listAllPayments(slug);
      if (request === requestRef.current) setRows(payments);
    } catch (caught) {
      if (request === requestRef.current) setError(errorToText(caught as ApiError, "تعذّر تحميل إشعارات الدفع."));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [slug, errorToText]);
  useEffect(() => { void load(); return () => { requestRef.current += 1; }; }, [load]);

  const term = normalize(query);
  const matches = rows.filter((claim) =>
    (status === "all" || claim.status === status) && (method === "all" || claim.method === method) &&
    normalize(`${claim.student_name} ${claim.student_email} ${claim.course_title} ${claim.id}`).includes(term));
  matches.sort((a, b) => sort === "newest" ? Date.parse(b.submitted_at) - Date.parse(a.submitted_at) : Date.parse(a.submitted_at) - Date.parse(b.submitted_at));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(matches.length / PAGE_SIZE)));
  const visible = matches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  function openDecision(claim: PaymentSubmission, action: Decision["action"], element: HTMLElement) {
    opener.current = element;
    setDecision({ claim, action });
  }
  function closeDecision() {
    setDecision(null);
    requestAnimationFrame(() => {
      if (opener.current?.isConnected) opener.current.focus();
      else resultsRef.current?.focus();
    });
  }
  function reviewed(claim: PaymentSubmission) {
    setRows((current) => current.map((item) => item.id === claim.id ? claim : item));
    setNotice(claim.status === "confirmed" ? `تم تأكيد إشعار ${claim.student_name} لدورة «${claim.course_title}» وتفعيل تسجيله.` : `تم رفض إشعار ${claim.student_name} لدورة «${claim.course_title}» مع حفظ السبب.`);
    closeDecision();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-line bg-section p-6 sm:p-8" aria-label="مراجعة مدفوعات المساحة">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-accent"><ReviewIcon name="receipt" />مساحة {publicProfile?.teacher_name || workspace?.name || "المعلّم"}</div>
        <div className="[&_h1]:text-3xl [&_h1]:font-extrabold"><PageHeader title="مراجعة المدفوعات" subtitle="طابق كل إشعار بالطالب والدورة والدفعة المستلمة، ثم اتّخذ قرارك." /></div>
        <div className="text-sm leading-8 text-ink">هذه إشعارات دفع يدوي، وليست تحويلات بنكية تتحقّق منها المنصّة تلقائيًا.</div>
      </section>
      <div role="status" aria-live="polite" className={notice ? "rounded-card border border-line bg-accent-soft p-4 text-ink" : "sr-only"}>{notice}</div>
      {loading ? <FullPageSpinner /> : error ? <Card><Alert tone="error">{error}</Alert><Button variant="secondary" className="mt-4" onClick={() => void load()}>إعادة المحاولة</Button></Card> : (
        <>
          <dl className="grid gap-4 sm:grid-cols-3">{FILTERS.map((item) => <Card key={item.value}><dt className="text-sm font-bold text-ink">{item.label}</dt><dd className="mt-3 text-3xl font-extrabold text-accent">{digits(rows.filter((claim) => claim.status === item.value).length)}</dd><div className="mt-2 text-sm text-ink">{item.hint}</div></Card>)}</dl>
          <div className="grid items-start gap-6 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <Card className="space-y-5 p-6">
                <div><Label htmlFor="payment-search">ابحث في إشعارات الدفع</Label><Input id="payment-search" type="search" className="min-h-12" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="اسم الطالب، البريد، الدورة أو رقم الإشعار" /><div className="mt-2 text-sm text-ink">يشمل البحث جميع الإشعارات المطابقة للفلاتر، وليس الصفحة الحالية فقط.</div></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label htmlFor="payment-method">طريقة الدفع</Label><Select id="payment-method" className="min-h-12" value={method} onChange={(event) => { setMethod(event.target.value); setPage(1); }}><option value="all">كل طرق الدفع</option>{Object.entries(METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
                  <div><Label htmlFor="payment-sort">ترتيب الإشعارات</Label><Select id="payment-sort" className="min-h-12" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="oldest">الأقدم إرسالًا أولًا</option><option value="newest">الأحدث إرسالًا أولًا</option></Select></div>
                </div>
                <div className="flex flex-wrap gap-2" aria-label="حالة الإشعارات">{[{ value: "all" as const, label: "كل الإشعارات" }, ...FILTERS].map((item) => <Button key={item.value} className="min-h-11" variant={status === item.value ? "primary" : "secondary"} aria-pressed={status === item.value} onClick={() => { setStatus(item.value); setPage(1); }}>{item.label}</Button>)}</div>
              </Card>
              <div className="flex flex-wrap items-center justify-between gap-3"><div ref={resultsRef} tabIndex={-1} role="status" className="rounded-control text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent">{digits(matches.length)} إشعارات مطابقة من أصل {digits(rows.length)}</div><Button variant="ghost" className="min-h-11" onClick={() => { setNotice(""); void load(); }}>تحديث القائمة</Button></div>
              {visible.length === 0 ? <Card><EmptyState title={rows.length === 0 ? "لم تصلك إشعارات دفع بعد" : term || method !== "all" ? "لا توجد إشعارات مطابقة" : "لا توجد إشعارات بهذه الحالة"} hint={rows.length === 0 ? "ستظهر هنا الإشعارات التي يقدّمها الطلاب بعد الدفع." : "جرّب تغيير البحث أو الفلاتر لعرض إشعارات أخرى."} />{rows.length > 0 && <Button variant="secondary" className="mt-4" onClick={() => { setQuery(""); setMethod("all"); setStatus("all"); setPage(1); }}>عرض كل الإشعارات</Button>}</Card> : (
                <ul className="space-y-5">{visible.map((claim) => <li key={claim.id}><Card className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="mb-1 text-sm text-ink">إشعار رقم {digits(claim.id)}</div><div role="heading" aria-level={2} className="text-lg font-bold leading-8 text-ink">{claim.course_title}</div></div><PaymentBadge status={claim.status} /></div>
                  <div className="mt-4 rounded-card bg-soft p-4"><div className="font-bold text-ink">{claim.student_name}</div><div dir="ltr" className="mt-1 break-all text-start text-sm leading-7 text-ink">{claim.student_email}</div></div>
                  <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                    <div><dt className="text-sm text-ink">مبلغ الإشعار</dt><dd dir="ltr" className="mt-1 text-start text-xl font-extrabold text-accent">{formatPrice(claim.amount)}</dd></div>
                    <div><dt className="text-sm text-ink">طريقة الدفع</dt><dd className="mt-1 font-bold text-ink">{METHODS[claim.method] ?? claim.method}</dd></div>
                    <div><dt className="text-sm text-ink">تاريخ الإرسال</dt><dd className="mt-1 text-sm leading-7 text-ink">{formatDate(claim.submitted_at)}</dd></div>
                  </dl>
                  {claim.note && <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-8 text-ink"><span className="font-bold">ملاحظة الطالب: </span>{claim.note}</div>}
                  <div className="mt-5 border-t border-line pt-4"><ReceiptAction claim={claim} slug={slug} /></div>
                  {claim.status === "rejected" && claim.rejection_reason && <div className="mt-4 whitespace-pre-wrap break-words rounded-card bg-soft p-4 text-sm leading-8 text-ink"><span className="font-bold">سبب الرفض: </span>{claim.rejection_reason}</div>}
                  {claim.status !== "submitted" && <div className="mt-4 text-sm leading-8 text-ink">{claim.reviewed_by_name && <span>راجعه {claim.reviewed_by_name} · </span>}{claim.reviewed_at && <span>{formatDate(claim.reviewed_at)}</span>}<div>تمت مراجعة هذا الإشعار. لا تتوفّر إعادة اتخاذ القرار هنا.</div></div>}
                  {claim.status === "submitted" && <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm text-ink"><ReviewIcon name="clock" />بانتظار مطابقة الدفعة</div><div className="flex flex-wrap gap-2"><Button size="lg" onClick={(event) => openDecision(claim, "confirm", event.currentTarget)}>مراجعة وتأكيد</Button><Button size="lg" variant="secondary" onClick={(event) => openDecision(claim, "reject", event.currentTarget)}>رفض الإشعار</Button></div></div>}
                </Card></li>)}</ul>
              )}
              {matches.length > PAGE_SIZE && <PaginationControls page={currentPage} count={matches.length} pageSize={PAGE_SIZE} hasPrevious={currentPage > 1} hasNext={currentPage * PAGE_SIZE < matches.length} onPrevious={() => { setPage(currentPage - 1); resultsRef.current?.focus(); }} onNext={() => { setPage(currentPage + 1); resultsRef.current?.focus(); }} />}
            </div>
            <aside className="space-y-5" aria-label="إرشادات مراجعة الدفعات">
              <section className="rounded-panel bg-panel p-6 text-panel-fg"><div role="heading" aria-level={2} className="text-xl font-bold">قبل تأكيد أي إشعار</div><ol className="mt-5 space-y-5">{[["طابق صاحب الدفعة", "راجع الطالب والدورة ومرجع العملية إن ذكره الطالب."], ["تحقّق من المبلغ المستلم", "راجعه في وسيلة الدفع الفعلية؛ الصورة وحدها لا تثبت وصول المال."], ["تأكّد من عدم تكرار العملية", "راجع الإشعارات السابقة قبل تفعيل التسجيل."]].map(([title, hint], index) => <li key={title} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current text-sm">{digits(index + 1)}</span><div><div className="font-bold">{title}</div><div className="mt-1 text-sm leading-8">{hint}</div></div></li>)}</ol></section>
              <Card><div role="heading" aria-level={2} className="text-lg font-bold text-ink">التأكيد يفعّل التسجيل</div><div className="mt-3 text-sm leading-8 text-ink">تأكيد الإشعار يفعّل اشتراك الطالب في الدورة المرتبطة به، ولا ينفّذ تحويلًا ماليًا جديدًا.</div></Card>
            </aside>
          </div>
        </>
      )}
      {decision && <PaymentDecision key={`${decision.claim.id}:${decision.action}`} decision={decision} slug={slug} onClose={closeDecision} onReviewed={reviewed} />}
    </div>
  );
}

function PaymentDecision({ decision, slug, onClose, onReviewed }: { decision: Decision; slug: string; onClose: () => void; onReviewed: (claim: PaymentSubmission) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const guard = useRef(false);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const errorToText = useApiErrorText();
  const { claim } = decision;
  const reject = decision.action === "reject";
  useEffect(() => { dialogRef.current?.showModal(); }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (guard.current || conflict || (reject ? !reason.trim() : !verified)) return;
    guard.current = true;
    setBusy(true);
    setError(null);
    try {
      const updated = reject ? await rejectPayment(slug, claim.id, reason.trim()) : await confirmPayment(slug, claim.id);
      onReviewed(updated);
    } catch (caught) {
      const apiError = caught as ApiError;
      setConflict(apiError.status === 409);
      setError(apiError.status === 409 ? "تمت مراجعة هذا الإشعار بالفعل. أغلق النافذة ثم اضغط «تحديث القائمة» للاطّلاع على حالته الحالية؛ لا تكرّر القرار." : errorToText(apiError, "تعذّر حفظ القرار. بيانات المراجعة ما زالت موجودة؛ حاول مرة أخرى."));
    } finally { guard.current = false; setBusy(false); }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="payment-decision-title" aria-describedby="payment-decision-hint" onCancel={(event) => { event.preventDefault(); if (!guard.current) onClose(); }} className="m-auto max-h-dvh w-full max-w-xl overflow-y-auto rounded-panel border border-line bg-surface p-6 text-ink shadow-elevated backdrop:bg-panel/50 sm:p-8">
      <div id="payment-decision-title" role="heading" aria-level={2} className="text-2xl font-extrabold">{reject ? "رفض إشعار الدفع" : "مراجعة الدفعة وتأكيدها"}</div>
      <div className="mt-3 text-sm">إشعار رقم {digits(claim.id)}</div>
      <dl className="my-5 space-y-3 rounded-card bg-soft p-5 text-sm leading-7">{[["الطالب", claim.student_name], ["البريد", claim.student_email], ["الدورة", claim.course_title], ["المبلغ", formatPrice(claim.amount)], ["الطريقة", METHODS[claim.method] ?? claim.method]].map(([label, value]) => <div key={label}><dt className="font-bold">{label}</dt><dd dir="auto" className="break-words">{value}</dd></div>)}</dl>
      {claim.note && <div className="mb-4 whitespace-pre-wrap break-words text-sm leading-8"><span className="font-bold">ملاحظة الطالب: </span>{claim.note}</div>}
      <ReceiptAction claim={claim} slug={slug} />
      <div id="payment-decision-hint" className="mt-5 text-sm leading-8">{reject ? "يبقى التسجيل بانتظار الدفع، ويمكن للطالب تقديم إشعار جديد بعد تصحيح المشكلة. رفض الإشعار لا ينفّذ استردادًا ولا يرفض حساب الطالب." : "التأكيد يفعّل تسجيل الطالب في هذه الدورة. طابق الدفعة المستلمة فعليًا قبل المتابعة؛ المنصّة لا تتحقّق من التحويل البنكي تلقائيًا."} لا يمكن تغيير القرار من هذه الصفحة بعد حفظه.</div>
      <form className="mt-5 space-y-5" onSubmit={(event) => void submit(event)} aria-busy={busy}>
        {error && <Alert tone="error">{error}</Alert>}
        {reject ? <div><Label htmlFor="payment-rejection-reason">سبب الرفض (مطلوب)</Label><Textarea id="payment-rejection-reason" rows={4} required maxLength={1000} disabled={busy} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="وضّح المشكلة وكيف يمكن تصحيحها دون طلب بيانات حسّاسة" aria-describedby="payment-reason-count" /><div id="payment-reason-count" className="mt-2 text-sm">{digits(reason.length)} / {digits(1000)} حرف</div></div> : (
          <div className="flex items-start gap-3 rounded-card border border-line p-4">
            <Input id="payment-verified" type="checkbox" required disabled={busy} checked={verified} onChange={(event) => setVerified(event.target.checked)} className="mt-1 h-5 w-5! shrink-0 p-0! accent-accent" />
            <Label htmlFor="payment-verified" className="min-w-0 flex-1 leading-7">راجعت وصول المبلغ ومطابقته لهذا الطالب وهذه الدورة، وتحقّقت من عدم تكرار العملية.</Label>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="secondary" size="lg" autoFocus disabled={busy} onClick={onClose}>إلغاء والعودة</Button><Button type="submit" size="lg" variant={reject ? "danger" : "primary"} disabled={busy || conflict || (reject ? !reason.trim() : !verified)}>{busy && <Spinner className="h-4 w-4" />}{busy ? "جارٍ حفظ القرار..." : reject ? "تأكيد رفض الإشعار" : "تأكيد الدفعة وتفعيل التسجيل"}</Button></div>
      </form>
    </dialog>
  );
}
