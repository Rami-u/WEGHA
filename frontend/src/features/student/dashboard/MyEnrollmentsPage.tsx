import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { listMyEnrollments } from "../../../api/enrollments";
import { submitPaymentClaim } from "../../../api/payments";
import { Alert, Button, Card, CourseCover, EmptyState, EnrollmentBadge, FieldError, FullPageSpinner, Input, Label, PageHeader, Select, Spinner, Textarea } from "../../../components/ui";
import { useSession } from "../../../context/SessionContext";
import { useApiErrorText } from "../../../lib/apiErrorText";
import { ApiError } from "../../../lib/apiClient";
import { formatDate, formatPrice } from "../../../lib/format";
import type { Enrollment } from "../../../types/api";

const PAYMENT_METHODS = [
  { value: "transfer", label: "تحويل بنكي" },
  { value: "e_wallet", label: "محفظة إلكترونية" },
  { value: "cash", label: "نقدي" },
  { value: "other", label: "أخرى" },
];
const MAX_NOTE_LENGTH = 1000;
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
const RECEIPT_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const FILTERS = [
  { value: "all", label: "كل التسجيلات" },
  { value: "pending_payment", label: "بانتظار الدفع" },
  { value: "active", label: "نشطة" },
  { value: "withdrawn", label: "منسحبة" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];
const linkBase = "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";
const digits = (value: number) => value.toLocaleString("ar");

function EnrollmentIcon({ name }: { name: "receipt" | "arrow" | "check" | "clock" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden>
      {name === "receipt" && <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></>}
      {name === "arrow" && <path d="M20 12H4m7-7-7 7 7 7" />}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "clock" && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
    </svg>
  );
}

export default function MyEnrollmentsPage() {
  const { slug } = useSession();
  return <EnrollmentWorkspace key={slug} slug={slug ?? ""} />;
}

// Keep the named route import compatible with the existing router.
export { MyEnrollmentsPage };

function EnrollmentWorkspace({ slug }: { slug: string }) {
  const { publicProfile, workspace } = useSession();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [claimedIds, setClaimedIds] = useState<number[]>([]);
  const errorToText = useApiErrorText();

  const load = useCallback(async () => {
    setLoading(true);
    setErrorText(null);
    try {
      setEnrollments(await listMyEnrollments(slug));
    } catch (error) {
      setErrorText(errorToText(error as ApiError, "تعذّر تحميل تسجيلاتك."));
    } finally {
      setLoading(false);
    }
  }, [slug, errorToText]);

  useEffect(() => { void load(); }, [load]);

  const pending = enrollments.filter((item) => item.status === "pending_payment").length;
  const active = enrollments.filter((item) => item.status === "active").length;
  const ordered = [...enrollments].sort((a, b) => Number(b.status === "pending_payment") - Number(a.status === "pending_payment"));
  const visible = ordered.filter((item) => filter === "all" || item.status === filter);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-panel border border-line bg-surface" aria-label="ملخص تسجيلاتي">
        <div className="flex flex-wrap items-start justify-between gap-4 bg-section p-6 sm:p-8">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-accent"><EnrollmentIcon name="receipt" />مساحة {publicProfile?.teacher_name || workspace?.name || "معلّمك"}</div>
            <div className="[&_h1]:text-3xl [&_h1]:font-extrabold">
              <PageHeader title="تسجيلاتي وإشعار الدفع" subtitle="تابع حالة دوراتك، وقدّم إشعار الدفع بعد إتمامه خارج المنصّة." />
            </div>
          </div>
          <Link to="/courses" className={`${linkBase} border border-line bg-surface text-accent hover:bg-soft`}>استعرض الدورات<EnrollmentIcon name="arrow" /></Link>
        </div>
        {!loading && !errorText && <dl className="grid grid-cols-3 divide-x divide-x-reverse divide-line border-t border-line py-5 text-center">
          {[[enrollments.length, "إجمالي التسجيلات"], [pending, "بانتظار الدفع"], [active, "دورات نشطة"]].map(([value, label]) => <div key={label} className="px-2"><dd className="text-2xl font-extrabold text-ink">{digits(Number(value))}</dd><dt className="mt-1 text-sm text-ink">{label}</dt></div>)}
        </dl>}
      </section>

      {loading ? <FullPageSpinner /> : errorText ? (
        <Card><Alert tone="error">{errorText}</Alert><Button variant="secondary" className="mt-4" onClick={() => void load()}>إعادة المحاولة</Button></Card>
      ) : enrollments.length === 0 ? (
        <Card><EmptyState title="لم تسجّل في أي دورة بعد" hint="اختر دورة من مكتبة معلّمك، وستظهر حالة تسجيلها هنا." /><Link to="/courses" className={`${linkBase} mt-4 bg-accent text-accent-contrast`}>استكشف الدورات</Link></Card>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            <div className="flex flex-wrap gap-2" aria-label="تصفية التسجيلات">
              {FILTERS.map((item) => <Button key={item.value} variant={filter === item.value ? "primary" : "secondary"} className="min-h-11" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}<span>{digits(item.value === "all" ? enrollments.length : enrollments.filter((entry) => entry.status === item.value).length)}</span></Button>)}
            </div>
            <div role="status" className="text-sm text-ink">{digits(visible.length)} تسجيلات · تظهر الدورات بانتظار الدفع أولًا</div>
            {visible.length === 0 && <Card><EmptyState title="لا توجد تسجيلات بهذه الحالة" hint="اختر حالة أخرى لعرض دوراتك." /><Button className="mt-4" variant="secondary" onClick={() => setFilter("all")}>عرض كل التسجيلات</Button></Card>}
            <ul className="space-y-5">
              {ordered.map((enrollment) => (
                <li key={enrollment.id} hidden={filter !== "all" && enrollment.status !== filter}>
                  <Card className="p-6">
                    <div className="flex flex-wrap items-start gap-4">
                      <CourseCover courseId={enrollment.course_id} title={enrollment.course_title} />
                      <div className="min-w-0 flex-1">
                        <Link to={`/courses/${enrollment.course_id}`} className="rounded-control text-lg font-bold text-ink hover:text-accent focus-visible:outline-accent">{enrollment.course_title}</Link>
                        <div className="mt-2 text-sm leading-7 text-ink">تاريخ التسجيل: {formatDate(enrollment.created_at)}</div>
                        {enrollment.activated_at && <div className="text-sm leading-7 text-ink">تاريخ التفعيل: {formatDate(enrollment.activated_at)}</div>}
                      </div>
                      <EnrollmentBadge status={enrollment.status} />
                    </div>
                    <div className="mt-5 flex flex-wrap justify-between gap-3 border-t border-line pt-4 text-sm text-ink">
                      <span>المبلغ وقت التسجيل</span><span dir="ltr" className="font-bold">{formatPrice(enrollment.price_at_enrollment)}</span>
                    </div>

                    {enrollment.status === "active" && <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-card bg-accent-soft p-4">
                      <div className="flex items-center gap-2 font-bold text-ink"><EnrollmentIcon name="check" />الوصول مفعّل. جاهز لخطوتك التالية؟</div>
                      <Link to={`/courses/${enrollment.course_id}/lessons/l1`} className={`${linkBase} bg-accent text-accent-contrast`}>افتح الدروس<EnrollmentIcon name="arrow" /></Link>
                    </div>}
                    {enrollment.status === "withdrawn" && <div className="mt-4 rounded-card bg-soft p-4 text-sm leading-7 text-ink">هذا التسجيل منسحب. يمكنك مراجعة تفاصيل الدورة من عنوانها بالأعلى.</div>}
                    {enrollment.status === "pending_payment" && (claimedIds.includes(enrollment.id) ? (
                      <div className="mt-5 rounded-card border border-line bg-accent-soft p-5 text-ink" role="status">
                        <div className="flex items-center gap-2 font-bold"><EnrollmentIcon name="clock" />تم إرسال الإشعار في هذه الزيارة</div>
                        <div className="mt-2 text-sm leading-8">الخطوة التالية: مراجعة المعلّم. يبقى التسجيل بانتظار الدفع حتى تأكيده؛ لا تكرّر الدفع أو الإرسال بسبب بقاء الحالة.</div>
                      </div>
                    ) : <PaymentClaimForm slug={slug} enrollment={enrollment} onClaimed={() => setClaimedIds((current) => [...new Set([...current, enrollment.id])])} />)}
                  </Card>
                </li>
              ))}
            </ul>
          </div>

          <aside className="space-y-5" aria-label="إرشادات الدفع">
            <section className="rounded-panel bg-panel p-6 text-panel-fg">
              <div role="heading" aria-level={2} className="text-xl font-bold">من الدفع إلى التعلّم</div>
              <ol className="mt-5 space-y-5">
                {[
                  ["ادفع وفق تعليمات المعلّم", "الدفع يتم خارج المنصّة، وليس من خلال نموذج الإشعار."],
                  ["أرسل إشعارًا بعد الدفع", "حدّد الطريقة وأضف الإيصال أو مرجع العملية إن رغبت."],
                  ["انتظر تأكيد المعلّم", "بعد التأكيد يصبح التسجيل نشطًا وتفتح الدروس."],
                ].map(([title, hint], index) => <li key={title} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current text-sm">{digits(index + 1)}</span><div><div className="font-bold">{title}</div><div className="mt-1 text-sm leading-8">{hint}</div></div></li>)}
              </ol>
            </section>
            <Card>
              <div role="heading" aria-level={2} className="text-lg font-bold text-ink">لماذا ما زالت الحالة بانتظار الدفع؟</div>
              <div className="mt-3 text-sm leading-8 text-ink">حالة التسجيل وحدها لا توضّح إن كان هناك إشعار سابق. لو أرسلته بالفعل، انتظر المراجعة ولا تعِد الدفع.</div>
              <div className="mt-4 border-t border-line pt-4 text-sm leading-8 text-ink">علامة «تم إرسال الإشعار» هنا تخص هذه الزيارة فقط. لا يتوفّر في هذه الصفحة سجل كامل للإشعارات السابقة.</div>
            </Card>
            <Card>
              <div role="heading" aria-level={2} className="text-lg font-bold text-ink">حافظ على بياناتك</div>
              <div className="mt-3 text-sm leading-8 text-ink">لا تُدرج كلمة مرور أو رمز تحقّق أو بيانات بطاقة كاملة في الملاحظات أو الإيصال. إن لم تصلك تعليمات الدفع، تأكّد منها مع المعلّم قبل التحويل.</div>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}

function PaymentClaimForm({ slug, enrollment, onClaimed }: { slug: string; enrollment: Enrollment; onClaimed: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const sending = useRef(false);
  const reviewRef = useRef<HTMLDivElement>(null);
  const errorToText = useApiErrorText();
  const id = `claim-${enrollment.id}`;
  const methodLabel = PAYMENT_METHODS.find((item) => item.value === method)?.label;

  useEffect(() => { if (reviewing) reviewRef.current?.focus(); }, [reviewing]);

  function chooseReceipt(file: File | null) {
    setReceiptError(null);
    setReceipt(null);
    if (!file) return;
    if (!RECEIPT_TYPES.includes(file.type) || file.size > RECEIPT_MAX_BYTES || file.size === 0) {
      setReceiptError(file.size === 0 ? "الملف فارغ. اختر إيصالًا صالحًا أو أزله للمتابعة دون مرفق." : "اختر JPEG أو PNG أو PDF بحجم لا يتجاوز ٥ ميغابايت، أو أزل الملف للمتابعة دون مرفق.");
      setFileKey((current) => current + 1);
      return;
    }
    setReceipt(file);
  }

  async function submitClaim(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current || receiptError || !method) return;
    setFormError(null);
    if (!reviewing) { setReviewing(true); return; }
    sending.current = true;
    setSubmitting(true);
    try {
      await submitPaymentClaim(slug, enrollment.id, { method, note: note.trim() || null, receipt });
      onClaimed();
    } catch (error) {
      const apiError = error as ApiError;
      setFormError(apiError.status === 409
        ? "يوجد إشعار قيد المراجعة لهذا التسجيل. لا تكرّر الدفع أو الإرسال، وانتظر تأكيد المعلّم."
        : errorToText(apiError, "تعذّر إرسال الإشعار. بياناتك ما زالت موجودة؛ حاول مرة أخرى."));
    } finally {
      sending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-5 rounded-card border border-line bg-soft p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="font-bold text-ink">أتممت الدفع خارج المنصّة؟</div><div className="mt-1 text-sm leading-7 text-ink">قدّم الإشعار ليتمكّن المعلّم من مراجعة دفعتك.</div></div>
        <Button type="button" variant="secondary" className="min-h-11" aria-expanded={expanded} aria-controls={id} disabled={submitting} onClick={() => setExpanded((value) => !value)}>{expanded ? "طيّ النموذج" : "تقديم إشعار الدفع"}</Button>
      </div>
      {expanded && (
        <form id={id} className="mt-5 border-t border-line pt-5" onSubmit={(event) => void submitClaim(event)} aria-busy={submitting}>
          <div className="mb-5 text-sm font-bold text-accent">{reviewing ? "٢ من ٢ · مراجعة وإرسال" : "١ من ٢ · تفاصيل الدفع"}</div>
          {formError && <div className="mb-4"><Alert tone="error">{formError}</Alert></div>}
          <fieldset disabled={submitting} className="min-w-0 space-y-5">
            {!reviewing ? <>
              <div>
                <Label htmlFor={`${id}-method`}>طريقة الدفع (مطلوب)</Label>
                <Select id={`${id}-method`} required value={method} onChange={(event) => setMethod(event.target.value)} className="min-h-12">
                  <option value="" disabled>اختر الطريقة التي دفعت بها</option>
                  {PAYMENT_METHODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor={`${id}-receipt`}>إرفاق إيصال (اختياري)</Label>
                <div id={`${id}-file-hint`} className="mb-2 text-sm leading-7 text-ink">JPEG أو PNG أو PDF · حتى ٥ ميغابايت</div>
                <Input key={fileKey} id={`${id}-receipt`} type="file" accept="image/jpeg,image/png,application/pdf" className="min-h-12 w-full min-w-0 file:me-3 file:rounded-control file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:text-accent" aria-describedby={`${id}-file-hint${receiptError ? ` ${id}-file-error` : ""}`} invalid={Boolean(receiptError)} onChange={(event) => chooseReceipt(event.target.files?.[0] ?? null)} />
                <FieldError id={`${id}-file-error`} messages={receiptError ? [receiptError] : undefined} />
                {(receipt || receiptError) && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-control border border-line bg-surface p-3">
                  <div className="min-w-0 break-all text-sm text-ink">{receipt ? `${receipt.name} · ${Math.ceil(receipt.size / 1024).toLocaleString("ar")} كيلوبايت` : "لم يتم إرفاق الملف غير الصالح"}</div>
                  <Button type="button" variant="ghost" className="min-h-11" onClick={() => { setReceipt(null); setReceiptError(null); setFileKey((current) => current + 1); }}>{receipt ? "إزالة الملف" : "المتابعة دون مرفق"}</Button>
                </div>}
              </div>
              <div>
                <Label htmlFor={`${id}-note`}>ملاحظة للمعلّم (اختياري)</Label>
                <Textarea id={`${id}-note`} rows={3} maxLength={MAX_NOTE_LENGTH} value={note} onChange={(event) => setNote(event.target.value)} placeholder="مثل رقم مرجع العملية أو اسم صاحب التحويل" aria-describedby={`${id}-note-hint`} />
                <div id={`${id}-note-hint`} className="mt-2 flex flex-wrap justify-between gap-2 text-sm text-ink"><span>لا تكتب بيانات سرية أو رموز تحقّق.</span><span>{digits(note.length)} / {digits(MAX_NOTE_LENGTH)}</span></div>
              </div>
            </> : (
              <div ref={reviewRef} tabIndex={-1} className="rounded-card border border-line bg-surface p-4 focus-visible:outline-2 focus-visible:outline-accent">
                <div role="heading" aria-level={3} className="mb-4 font-bold text-ink">راجع الإشعار قبل إرساله</div>
                <dl className="space-y-3 text-sm leading-7 text-ink">
                  {[["الدورة", enrollment.course_title], ["المبلغ وقت التسجيل", formatPrice(enrollment.price_at_enrollment)], ["طريقة الدفع", methodLabel], ["الإيصال", receipt?.name || "بدون مرفق"], ["ملاحظتك", note.trim() || "لا توجد ملاحظة"]].map(([label, value]) => <div key={label}><dt className="font-bold">{label}</dt><dd dir="auto" className="whitespace-pre-wrap break-words">{value}</dd></div>)}
                </dl>
                <div className="mt-4 border-t border-line pt-4 text-sm leading-8 text-ink">إرسال الإشعار لا يخصم مبلغًا ولا يفعّل الدورة تلقائيًا. تأكّد أنك أتممت الدفع ولم تُرسل إشعارًا لنفس العملية من قبل.</div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" size="lg" disabled={submitting || Boolean(receiptError)}>{submitting && <Spinner className="h-4 w-4 border-accent-contrast/40 border-t-accent-contrast" />}{submitting ? "جارٍ الإرسال..." : reviewing ? "تأكيد وإرسال الإشعار" : "مراجعة الإشعار"}</Button>
              {reviewing && <Button type="button" variant="secondary" size="lg" disabled={submitting} onClick={() => { setReviewing(false); setFormError(null); }}>تعديل البيانات</Button>}
            </div>
          </fieldset>
          <div className="mt-3 text-sm leading-7 text-ink">التفعيل بعد تأكيد المعلّم. لم تدفع بعد؟ لا ترسل الإشعار قبل إتمام الدفع.</div>
        </form>
      )}
    </div>
  );
}
