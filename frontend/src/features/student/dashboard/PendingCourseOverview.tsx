import { Link } from "react-router-dom";

import { Card, CourseCover, EnrollmentBadge, PageHeader, PriceTag } from "../../../components/ui";
import { useSession } from "../../../context/SessionContext";
import type { Course } from "../../../types/api";

function PaymentIcon({ name }: { name: "clock" | "check" | "receipt" | "arrow" | "book" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden>
      {name === "clock" && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "receipt" && <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></>}
      {name === "arrow" && <path d="M20 12H4m7-7-7 7 7 7" />}
      {name === "book" && <><path d="M3 4c3-1 6 0 9 2v15c-3-2-6-3-9-2V4Z" /><path d="M12 6c3-2 6-3 9-2v15c-3-1-6 0-9 2" /></>}
    </svg>
  );
}

const linkBase = "inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";
const questions = [
  ["دفعت بالفعل، لماذا ما زالت الدورة بانتظار الدفع؟", "إتمام الدفع خارج المنصّة لا يفعّل التسجيل تلقائيًا. قدّم إشعار الدفع من «تسجيلاتي» إن لم تكن قد أرسلته، ثم انتظر تأكيد المعلّم. إذا أرسلته بالفعل، لا تكرّر الدفع أو الإشعار لمجرد أن الحالة لم تتغيّر."],
  ["ما الذي أحتاجه لتقديم الإشعار؟", "اختر طريقة الدفع وأضف ملاحظة أو مرجع التحويل إن احتجت. يمكنك إرفاق إيصال بصيغة JPEG أو PNG أو PDF، بحجم لا يتجاوز ٥ ميغابايت. الملاحظة والإيصال اختياريان في النموذج الحالي."],
  ["متى يمكنني بدء الدورة؟", "يتفعّل الوصول بعد تأكيد المعلّم للدفع. لا توجد مدة مراجعة محدّدة معروضة هنا؛ راجع حالة التسجيل من صفحة «تسجيلاتي»."],
];

/** Design preview only; no payment is collected or marked as confirmed here. */
export default function PendingCourseOverview({ course }: { course: Course }) {
  const { publicProfile, workspace } = useSession();
  const teacherName = publicProfile?.teacher_name || workspace?.name || "معلّمك";

  return (
    <div className="space-y-6">
      <Link to="/courses" className="inline-flex min-h-11 items-center text-sm font-bold text-accent hover:underline">مكتبة دوراتي / تفاصيل الدورة</Link>

      <section className="overflow-hidden rounded-panel border border-line bg-surface" aria-label="الدورة وحالة التسجيل">
        <div className="flex flex-wrap items-start gap-5 bg-section p-6 sm:p-8">
          <CourseCover courseId={course.id} title={course.title} size={64} />
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <EnrollmentBadge status="pending_payment" />
              <span className="text-sm text-ink">مساحة {teacherName}</span>
            </div>
            <div className="[&_h1]:text-2xl [&_h1]:font-extrabold sm:[&_h1]:text-3xl">
              <PageHeader title={course.title} subtitle="تسجيلك موجود؛ يتبقّى تأكيد الدفع لتفعيل الوصول." />
            </div>
          </div>
        </div>
        <ol className="grid gap-5 border-t border-line p-6 md:grid-cols-3 sm:p-8" aria-label="مراحل تفعيل الدورة">
          {[
            { title: "إنشاء التسجيل", hint: "تم تسجيلك في الدورة", icon: "check" as const, done: true },
            { title: "الدفع وإرسال الإشعار", hint: "من صفحة تسجيلاتي", icon: "receipt" as const, done: false },
            { title: "تأكيد المعلّم والتفعيل", hint: "يصبح الوصول نشطًا بعد التأكيد", icon: "book" as const, done: false },
          ].map((step, index) => (
            <li key={step.title} className="flex items-start gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${step.done ? "bg-accent-soft text-accent" : "bg-soft text-ink"}`}><PaymentIcon name={step.icon} /></span>
              <div><div className="font-bold text-ink">{["١", "٢", "٣"][index]} · {step.title}</div><div className="mt-1 text-sm leading-7 text-ink">{step.hint}</div></div>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="rounded-panel bg-panel p-6 text-panel-fg sm:p-8" aria-label="الخطوة التالية">
            <div className="mb-3 flex items-center gap-2 text-sm"><PaymentIcon name="clock" />بانتظار تأكيد الدفع</div>
            <div role="heading" aria-level={2} className="text-2xl font-extrabold leading-relaxed">خطوة واضحة، قبل بداية التعلّم.</div>
            <div className="mt-3 max-w-xl text-sm leading-8">لو دفعت بالفعل، انتقل إلى تسجيلاتك لتقديم الإشعار. ولو أرسلته من قبل، انتظر مراجعة المعلّم؛ لا تحتاج للدفع مرة أخرى.</div>
            <Link to="/my-enrollments" className={`${linkBase} mt-5 bg-surface text-accent hover:bg-soft`}>متابعة الدفع في تسجيلاتي<PaymentIcon name="arrow" /></Link>
            <div className="mt-3 text-sm leading-7">هذا الزر يفتح تسجيلاتك، ولا ينفّذ عملية دفع.</div>
          </section>

          <Card>
            <div role="heading" aria-level={2} className="flex items-center gap-2 text-lg font-bold text-ink"><PaymentIcon name="receipt" />قبل إرسال إشعار الدفع</div>
            <div className="mt-5 space-y-5">
              {[
                ["تأكّد من تعليمات المعلّم", "استخدم فقط وسيلة الدفع وبيانات المستلم التي حدّدها المعلّم. لا توجد بيانات تحويل معروضة في هذه الصفحة."],
                ["احتفظ بمرجع العملية", "بعد الدفع، احتفظ بالإيصال أو رقم المرجع ليسهل على المعلّم مطابقة الدفعة بتسجيلك."],
                ["قدّم الإشعار من تسجيلاتي", "اختر طريقة الدفع، وأرفق الإيصال أو ملاحظة إن رغبت. إرسال الإشعار لا يعني تأكيد الدفعة."],
              ].map(([title, hint], index) => (
                <div key={title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-soft text-sm font-bold text-accent">{["١", "٢", "٣"][index]}</span>
                  <div><div className="font-bold text-ink">{title}</div><div className="mt-1 text-sm leading-8 text-ink">{hint}</div></div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-card border border-line bg-soft p-4 text-sm leading-8 text-ink">لم تصلك تعليمات الدفع؟ ارجع للمعلّم عبر وسيلة التواصل المتّفق عليها قبل التحويل. لا ترسل كلمة مرورك أو رمز التحقّق ضمن الملاحظات أو الإيصال.</div>
          </Card>

          <Card>
            <div role="heading" aria-level={2} className="mb-4 text-lg font-bold text-ink">أسئلة في هذه المرحلة</div>
            <div className="divide-y divide-line">
              {questions.map(([question, answer]) => (
                <details key={question} className="py-4">
                  <summary className="cursor-pointer rounded-control font-bold leading-7 text-ink focus-visible:outline-2 focus-visible:outline-accent">{question}</summary>
                  <div className="mt-3 text-sm leading-8 text-ink">{answer}</div>
                </details>
              ))}
            </div>
          </Card>
        </div>

        <aside className="space-y-6" aria-label="ملخص التسجيل ومعلومات الدورة">
          <Card>
            <div role="heading" aria-level={2} className="text-lg font-bold text-ink">ملخص التسجيل</div>
            <div className="my-5 rounded-card bg-soft p-5">
              <div className="mb-2 text-sm text-ink">سعر الدورة الحالي</div>
              <PriceTag price={course.price} className="text-3xl font-extrabold" />
              <div className="mt-3 text-sm leading-7 text-ink">للتأكّد من المبلغ المسجّل وقت اشتراكك، راجع تفاصيل الدورة في «تسجيلاتي».</div>
            </div>
            <dl className="space-y-4 text-sm text-ink">
              <div className="flex justify-between gap-4"><dt>الحالة</dt><dd className="font-bold">بانتظار الدفع</dd></div>
              <div className="flex justify-between gap-4"><dt className="shrink-0">مساحة المعلّم</dt><dd className="text-end font-bold">{teacherName}</dd></div>
              <div className="flex justify-between gap-4"><dt>تفعيل الوصول</dt><dd className="text-end font-bold">بعد تأكيد المعلّم</dd></div>
            </dl>
            <div className="mt-5 border-t border-line pt-4 text-sm leading-7 text-ink">هذه الصفحة ليست فاتورة أو تأكيد استلام دفعة.</div>
          </Card>

          <Card>
            <div role="heading" aria-level={2} className="flex items-center gap-2 text-lg font-bold text-ink"><PaymentIcon name="book" />عن الدورة</div>
            <div className="mt-3 whitespace-pre-line text-sm leading-8 text-ink">{course.description || "لم يكتب المعلّم وصفًا لهذه الدورة بعد."}</div>
            <div className="mt-5 rounded-card bg-accent-soft p-4 text-sm leading-8 text-ink">بعد تأكيد الدفع، يمكنك بدء الدروس ومتابعة محتوى الدورة من مكتبتك.</div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
