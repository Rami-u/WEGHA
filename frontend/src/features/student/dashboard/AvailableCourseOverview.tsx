import { Link } from "react-router-dom";

import { Alert, Button, Card, CourseCover, PageHeader, PriceTag, Spinner } from "../../../components/ui";
import { useSession } from "../../../context/SessionContext";
import type { Course } from "../../../types/api";

function OverviewIcon({ name }: { name: "book" | "arrow" | "teacher" | "check" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden>
      {name === "book" && <><path d="M3 4c3-1 6 0 9 2v15c-3-2-6-3-9-2V4Z" /><path d="M12 6c3-2 6-3 9-2v15c-3-1-6 0-9 2" /></>}
      {name === "arrow" && <path d="M20 12H4m7-7-7 7 7 7" />}
      {name === "teacher" && <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
    </svg>
  );
}

type Props = {
  course: Course;
  enrolling: boolean;
  error: string | null;
  onEnroll: () => void;
};

/** Pre-enrollment design surface; the parent owns the existing enrollment flow. */
export default function AvailableCourseOverview({ course, enrolling, error, onEnroll }: Props) {
  const { publicProfile, workspace } = useSession();
  const teacherName = publicProfile?.teacher_name || workspace?.name || "معلّمك";
  const free = Number(course.price) === 0;
  const steps = free
    ? [
        ["سجّل مجانًا", "أضف الدورة إلى تسجيلاتك دون خطوات دفع."],
        ["يتفعّل الوصول مباشرة", "تنتقل الدورة إلى الحالة النشطة بعد نجاح التسجيل."],
        ["ابدأ من أول درس", "افتح محتوى الدورة من مكتبتك وتابع التعلّم."],
      ]
    : [
        ["أنشئ تسجيلك", "زر الاشتراك يسجّلك في الدورة، ولا يخصم أي مبلغ."],
        ["أكمل الدفع وقدّم الإشعار", "اتّبع تعليمات المعلّم، ثم أرسل إشعار الدفع من «تسجيلاتي»."],
        ["ابدأ بعد التأكيد", "تصبح الدورة نشطة بعد مراجعة المعلّم وتأكيد الدفعة."],
      ];
  const questions = [
    ["ماذا يحدث عند الضغط على زر الاشتراك؟", free
      ? "يُنشأ تسجيل مجاني ويتفعّل الوصول بعد نجاح الطلب. لا تحتاج إلى إرسال إشعار دفع."
      : "يُنشأ تسجيل بحالة «بانتظار الدفع»، ولا يُخصم مبلغ من خلال هذا الزر. أكمل الدفع وفق تعليمات المعلّم وقدّم إشعاره ليؤكّد التسجيل."],
    ["هل التسجيل هنا يشمل دورات المعلّمين الآخرين؟", "لا، هذا التسجيل يخص هذه الدورة داخل مساحة المعلّم الحالية. الدورات الأخرى لها تسجيلاتها المستقلة."],
    ["هل توجد شهادة أو مدة محدّدة للوصول؟", "لا توجد تفاصيل مؤكّدة معروضة هنا عن شهادة أو مدة الوصول. تأكّد من هذه النقاط مع المعلّم قبل اتخاذ قرارك."],
  ];

  return (
    <div className="space-y-6">
      <Link to="/courses" className="inline-flex min-h-11 items-center text-sm font-bold text-accent hover:underline">مكتبة الدورات / تفاصيل الدورة</Link>

      <section className="overflow-hidden rounded-panel border border-line bg-surface" aria-label="التعرّف على الدورة">
        <div className="flex flex-wrap items-start gap-5 bg-section p-6 sm:p-8">
          <CourseCover courseId={course.id} title={course.title} size={64} />
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-pill bg-accent-soft px-3 py-1 font-bold text-accent">متاحة للاشتراك</span>
              <span className="text-ink">مع {teacherName}</span>
            </div>
            <div className="[&_h1]:text-2xl [&_h1]:font-extrabold sm:[&_h1]:text-3xl">
              <PageHeader title={course.title} subtitle="تعرّف على الدورة، وحدّد إن كانت خطوتك التعليمية التالية." />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-line px-6 py-5 text-sm font-medium text-ink sm:px-8">
          <span className="flex items-center gap-2"><OverviewIcon name="teacher" />داخل مساحة معلّمك</span>
          <span className="flex items-center gap-2"><OverviewIcon name="check" />{free ? "تفعيل مباشر بعد التسجيل" : "تفعيل بعد تأكيد الدفع"}</span>
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card className="p-6 sm:p-8">
            <div role="heading" aria-level={2} className="flex items-center gap-2 text-xl font-bold text-ink"><OverviewIcon name="book" />عن هذه الدورة</div>
            <div className="mt-5 whitespace-pre-line leading-8 text-ink">{course.description || "لم يضف المعلّم وصفًا للدورة بعد. تأكّد من الموضوعات والمستوى المناسب مع المعلّم قبل الاشتراك."}</div>
            <div className="mt-6 rounded-card bg-soft p-5">
              <div role="heading" aria-level={3} className="font-bold text-ink">هل تناسب هدفك الآن؟</div>
              <div className="mt-2 text-sm leading-8 text-ink">قارن وصف الدورة بما تريد تعلّمه. إذا احتجت تفاصيل أكثر عن المحتوى أو المتطلّبات السابقة، تأكّد منها مع المعلّم قبل التسجيل.</div>
            </div>
          </Card>

          <section className="rounded-panel bg-panel p-6 text-panel-fg sm:p-8" aria-label="خطوات الانضمام">
            <div className="text-sm">من قرارك إلى بداية التعلّم</div>
            <div role="heading" aria-level={2} className="mt-2 text-2xl font-extrabold">ماذا يحدث بعد الاشتراك؟</div>
            <ol className="mt-6 space-y-6">
              {steps.map(([title, hint], index) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-current text-sm font-bold">{["١", "٢", "٣"][index]}</span>
                  <div><div className="font-bold">{title}</div><div className="mt-1 text-sm leading-8">{hint}</div></div>
                </li>
              ))}
            </ol>
          </section>

          <Card className="p-6 sm:p-8">
            <div role="heading" aria-level={2} className="text-xl font-bold text-ink">قبل اتخاذ قرارك</div>
            <div className="mt-2 text-sm leading-8 text-ink">نقاط تستحق التأكّد منها مع المعلّم إذا لم يوضّحها وصف الدورة.</div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ["المستوى والمتطلّبات", "ما المعرفة التي تحتاجها قبل البدء؟"],
                ["المحتوى والتطبيق", "ما الموضوعات والتمارين التي ستدرسها؟"],
                ["وقت وإتاحة التعلّم", "هل توجد مواعيد أو مدة محدّدة للوصول؟"],
                ["شروط الاشتراك", "ما سياسة الإلغاء أو الاسترداد، إن وجدت؟"],
              ].map(([title, hint]) => (
                <div key={title} className="rounded-card border border-line p-4"><div className="font-bold text-ink">{title}</div><div className="mt-2 text-sm leading-7 text-ink">{hint}</div></div>
              ))}
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <div role="heading" aria-level={2} className="mb-3 text-xl font-bold text-ink">أسئلة قبل الاشتراك</div>
            <div className="divide-y divide-line">
              {questions.map(([question, answer]) => (
                <details key={question} className="py-4">
                  <summary className="cursor-pointer rounded-control font-bold leading-8 text-ink focus-visible:outline-2 focus-visible:outline-accent">{question}</summary>
                  <div className="mt-3 text-sm leading-8 text-ink">{answer}</div>
                </details>
              ))}
            </div>
          </Card>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6" aria-label="الاشتراك ومعلومات المعلّم">
          <Card className="overflow-hidden p-6">
            <div className="mb-2 text-sm font-bold text-ink">الاشتراك في الدورة</div>
            <PriceTag price={course.price} className="text-4xl font-extrabold" />
            <div className="mt-4 text-sm leading-8 text-ink">{free ? "هذه الدورة مجانية. الوصول يتفعّل بمجرد نجاح التسجيل." : "الدفع وفق تعليمات المعلّم. يبدأ الوصول بعد تأكيد الدفعة، وليس بمجرد الضغط على الزر."}</div>
            <div className="my-5 border-t border-line pt-5">
              <dl className="space-y-4 text-sm text-ink">
                <div className="flex justify-between gap-3"><dt>الحالة الحالية</dt><dd className="font-bold">لم تشترك بعد</dd></div>
                <div className="flex justify-between gap-3"><dt>نوع التسجيل</dt><dd className="font-bold">{free ? "مجاني" : "بمقابل"}</dd></div>
                <div className="flex justify-between gap-3"><dt>تفعيل الوصول</dt><dd className="text-end font-bold">{free ? "بعد نجاح التسجيل" : "بعد تأكيد المعلّم"}</dd></div>
              </dl>
            </div>
            {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
            <Button size="lg" className="w-full" disabled={enrolling} onClick={onEnroll}>
              {enrolling ? <><Spinner />جارٍ التسجيل...</> : <>{free ? "اشترك مجانًا" : "اشترك وتابع الدفع"}<OverviewIcon name="arrow" /></>}
            </Button>
            <div className="mt-3 text-center text-sm leading-7 text-ink">{free ? "لا توجد خطوة دفع لهذه الدورة." : "لن يتم خصم مبلغ عند الضغط."}</div>
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><OverviewIcon name="teacher" /></span>
              <div><div className="text-sm text-ink">تعلّم مع</div><div role="heading" aria-level={2} className="font-bold text-ink">{teacherName}</div></div>
            </div>
            {publicProfile?.headline && <div className="text-sm font-bold leading-7 text-accent">{publicProfile.headline}</div>}
            <Link to="/" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-control text-sm font-bold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">استكشف مساحة المعلّم<OverviewIcon name="arrow" /></Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
