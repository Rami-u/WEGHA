import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getPublicTeacherProfile } from "../../api/public";
import { Button, Card, CourseCover, EmptyState, FullPageSpinner, PageHeader, PriceTag, WorkspaceLogo } from "../../components/ui";
import { useApiErrorText } from "../../lib/apiErrorText";
import { ApiError } from "../../lib/apiClient";
import { subdomainUrl } from "../../lib/slug";
import type { PublicTeacherProfile } from "../../types/api";
import "./teacher-profile.css";

function ProfileIcon({ name, className = "h-5 w-5" }: { name: "book" | "arrow" | "share" | "check" | "person" | "grid" | "chevron"; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {name === "book" && <><path d="M3 4.5c3-1 6-1 9 1v15c-3-2-6-2-9-1v-15Z" /><path d="M12 5.5c3-2 6-2 9-1v15c-3-1-6-1-9 1v-15Z" /></>}
      {name === "arrow" && <path d="M20 12H4m7-7-7 7 7 7" />}
      {name === "share" && <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" /></>}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "person" && <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>}
      {name === "grid" && <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>}
      {name === "chevron" && <path d="m6 9 6 6 6-6" />}
    </svg>
  );
}

const JOIN_STEPS = [
  { title: "أنشئ حسابك في المساحة", text: "سجّل بياناتك مع المعلّم الذي اخترته، وليس في حساب عام للمنصّة." },
  { title: "انتظر موافقة المعلّم", text: "يراجع المعلّم طلب انضمامك قبل إتاحة الدخول إلى مساحته." },
  { title: "اختر دورتك وابدأ التعلّم", text: "بعد قبولك، استعرض الدورات واختر ما يناسب هدفك." },
];

/**
 * Main-domain teacher profile: who the teacher is and what they teach.
 * The registration button links to that teacher's sub-domain —
 * no token or session is carried over.
 */
export function TeacherProfilePage() {
  const { slug = "" } = useParams();
  const [profile, setProfile] = useState<PublicTeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const errorToText = useApiErrorText();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorText(null);
      setProfile(null);
      setShareMessage("");
      setCopied(false);
      try {
        const response = await getPublicTeacherProfile(slug);
        if (!cancelled) setProfile(response);
      } catch (error) {
        if (!cancelled) setErrorText(errorToText(error as ApiError, "تعذّر تحميل صفحة هذا المعلّم."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, errorToText]);

  async function copyProfileLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}`);
      setCopied(true);
      setShareMessage("تم نسخ رابط الملف. يمكنك مشاركته الآن.");
    } catch {
      setCopied(false);
      setShareMessage("تعذّر نسخ الرابط. يمكنك نسخه من شريط العنوان.");
    }
  }

  if (loading) {
    return <FullPageSpinner />;
  }

  if (!profile) {
    return (
      <div className="text-center">
        <p className="text-lg font-bold text-ink">لم يتم العثور على المعلّم</p>
        <p className="mt-2 text-sm text-ink-secondary">{errorText ?? "هذا المعلّم غير مُدرج في الدليل."}</p>
        <Link to="/teachers" className="mt-6 inline-block">
          <Button variant="secondary">العودة إلى الدليل</Button>
        </Link>
      </div>
    );
  }

  const teacherName = profile.teacher_name || profile.name;
  const signupUrl = subdomainUrl(profile.slug, "/signup");

  return (
    <div className="teacher-profile">
      <div className="mb-6 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
        <Link to="/" className="hover:text-accent">الرئيسية</Link><span aria-hidden>/</span>
        <Link to="/teachers" className="hover:text-accent">دليل المعلّمين</Link><span aria-hidden>/</span>
        <span className="text-ink" aria-current="page">{teacherName}</span>
      </div>

      <Card className="profile-hero overflow-hidden">
        <div className="relative overflow-hidden bg-panel px-6 py-8 text-panel-fg sm:px-8">
          <p className="relative z-10 flex items-center gap-2 text-sm text-panel-fg/85">
            <ProfileIcon name="book" /> مساحة تعلّم مستقلة على وجهة
          </p>
          <ProfileIcon name="book" className="absolute -top-4 end-8 h-32 w-32 -rotate-12 text-panel-fg/10" />
        </div>
        <div className="px-6 pb-6 sm:px-8">
          <div className="profile-avatar relative -mt-5 mb-5 inline-flex rounded-panel border border-line bg-surface p-1.5">
            <WorkspaceLogo src={profile.logo} name={teacherName} size={80} />
          </div>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 [&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:leading-relaxed sm:[&_h1]:text-4xl [&_p]:text-base">
              <span className="mb-2 inline-block text-xs font-medium text-accent">تعرّف على معلّمك</span>
              <PageHeader title={teacherName} subtitle={profile.headline ?? "استكشف مساحة المعلّم ودوراته قبل أن تبدأ رحلتك."} />
              <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-2 rounded-pill bg-soft px-3 py-1.5"><ProfileIcon name="grid" className="h-3.5 w-3.5" />{profile.name}</span>
                <span dir="ltr">@{profile.slug}</span>
              </div>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto">
              <Link reloadDocument to={signupUrl} className="flex min-h-12 items-center justify-center gap-2 rounded-control bg-accent px-5 py-3 text-sm font-semibold text-accent-contrast hover:opacity-90">
                سجّل مع المعلّم<ProfileIcon name="arrow" className="h-4 w-4" />
              </Link>
              <Button variant="secondary" onClick={copyProfileLink}>
                <ProfileIcon name={copied ? "check" : "share"} />{copied ? "تم نسخ الرابط" : "مشاركة الملف"}
              </Button>
              <span role="status" className="max-w-56 text-xs text-ink-muted">{shareMessage}</span>
            </div>
          </div>
        </div>
        <nav aria-label="أقسام ملف المعلّم" className="flex gap-1 overflow-x-auto border-t border-line px-2 py-2 text-xs font-semibold text-ink-secondary sm:px-6 sm:text-sm">
          <Link reloadDocument to="#profile-about" className="shrink-0 rounded-control px-2 py-3 hover:bg-soft hover:text-accent sm:px-4">عن المعلّم</Link>
          <Link reloadDocument to="#profile-courses" className="shrink-0 rounded-control px-2 py-3 hover:bg-soft hover:text-accent sm:px-4">الدورات <span className="ms-1 text-xs text-ink-muted">({profile.courses.length.toLocaleString("ar")})</span></Link>
          <Link reloadDocument to="#profile-join" className="shrink-0 rounded-control px-2 py-3 hover:bg-soft hover:text-accent sm:px-4">كيف تنضم؟</Link>
        </nav>
      </Card>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section id="profile-about" className="scroll-mt-6" aria-label="عن المعلّم">
            <Card className="space-y-5">
              <p role="heading" aria-level={2} className="flex items-center gap-2 text-lg font-bold text-ink"><ProfileIcon name="person" className="text-accent h-5 w-5" />عن المعلّم</p>
              <p className="whitespace-pre-line text-sm leading-loose text-ink-secondary">{profile.bio || "لم يُضف المعلّم نبذته بعد. يمكنك استكشاف دوراته والتعرّف على مساحته التعليمية أدناه."}</p>
              {profile.about && <p className="whitespace-pre-line border-t border-line pt-5 text-sm leading-loose text-ink-secondary">{profile.about}</p>}
              <div className="grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
                <div className="rounded-card bg-soft p-4">
                  <ProfileIcon name="grid" className="mb-3 h-5 w-5 text-accent" />
                  <p className="text-sm font-bold text-ink">مساحة خاصة بمعلّمك</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-secondary">حسابك ودوراتك داخل مساحة المعلّم الذي تختاره.</p>
                </div>
                <div className="rounded-card bg-soft p-4">
                  <ProfileIcon name="book" className="mb-3 h-5 w-5 text-accent" />
                  <p className="text-sm font-bold text-ink">اختيار واضح قبل التسجيل</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-secondary">اطّلع على الدورات المنشورة وتفاصيلها أولًا.</p>
                </div>
              </div>
            </Card>
          </section>

          <section id="profile-courses" className="scroll-mt-6" aria-label="الدورات المنشورة">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p role="heading" aria-level={2} className="text-lg font-bold text-ink">استكشف الدورات</p>
              <span className="rounded-pill bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">{profile.courses.length.toLocaleString("ar")} دورة منشورة</span>
            </div>
            {profile.courses.length === 0 ? (
              <Card className="text-center">
                <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent"><ProfileIcon name="book" className="h-7 w-7" /></span>
                <EmptyState title="الدورات في طريقها إلى هنا" hint="لم ينشر هذا المعلّم دورات بعد. ستظهر دوراته وتفاصيلها في هذا القسم عند نشرها." />
              </Card>
            ) : (
              <ul className="space-y-3">
                {profile.courses.map((course) => (
                  <li key={course.id}>
                    <Card>
                      <div className="flex items-start gap-4">
                        <CourseCover courseId={course.id} title={course.title} />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-ink">{course.title}</p>
                          <span className="mt-1 inline-block text-xs text-ink-muted">دورة في مساحة {teacherName}</span>
                        </div>
                        <PriceTag price={course.price} className="shrink-0 text-sm" />
                      </div>
                      <details className="profile-disclosure mt-4 border-t border-line pt-4">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-accent">عن هذه الدورة<ProfileIcon name="chevron" className="h-4 w-4" /></summary>
                        <p className="mt-3 whitespace-pre-line text-sm leading-loose text-ink-secondary">{course.description || "لم يُضف المعلّم وصفًا لهذه الدورة بعد."}</p>
                      </details>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="profile-join" className="scroll-mt-6" aria-label="خطوات الانضمام">
            <Card>
              <p role="heading" aria-level={2} className="text-lg font-bold text-ink">من التعارف إلى التعلّم</p>
              <p className="mt-1 text-sm text-ink-secondary">ثلاث خطوات واضحة للانضمام إلى مساحة معلّمك.</p>
              <ol className="mt-6 space-y-5">
                {JOIN_STEPS.map((step, index) => (
                  <li key={step.title} className="flex items-start gap-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-accent/15 bg-accent-soft text-sm font-bold text-accent">{(index + 1).toLocaleString("ar")}</span>
                    <div><p className="text-sm font-semibold text-ink">{step.title}</p><p className="mt-1 text-xs leading-relaxed text-ink-secondary">{step.text}</p></div>
                  </li>
                ))}
              </ol>
            </Card>
          </section>

          <Card>
            <p role="heading" aria-level={2} className="mb-2 text-lg font-bold text-ink">قبل أن تبدأ</p>
            {[
              { q: "هل حسابي خاص بهذا المعلّم؟", a: "نعم، لكل معلّم مساحة مستقلة. تسجيلك هنا مرتبط بهذه المساحة، وليس بحساب عام لدى جميع المعلّمين." },
              { q: "هل التسجيل يشمل جميع الدورات؟", a: "التسجيل هو طلب انضمام إلى مساحة المعلّم. بعد قبولك، تختار الدورات وتنضم إليها وفق تفاصيل كل دورة." },
            ].map((faq) => (
              <details key={faq.q} className="profile-disclosure border-b border-line py-4 last:border-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink">{faq.q}<ProfileIcon name="chevron" className="h-4 w-4 shrink-0 text-ink-muted" /></summary>
                <p className="mt-3 text-sm leading-loose text-ink-secondary">{faq.a}</p>
              </details>
            ))}
          </Card>
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-6" aria-label="التسجيل مع المعلّم">
          <Card className="border-accent/20">
            <span className="mb-5 grid h-12 w-12 place-items-center rounded-card bg-accent-soft text-accent"><ProfileIcon name="book" className="h-6 w-6" /></span>
            <p className="text-xs font-medium text-accent">خطوتك القادمة</p>
            <p role="heading" aria-level={2} className="mt-2 text-xl font-extrabold leading-relaxed text-ink">ابدأ رحلتك مع {teacherName}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-secondary">أنشئ حسابك في مساحة هذا المعلّم، وأرسل طلب انضمامك لتبدأ بعد الموافقة.</p>
            <Link reloadDocument to={signupUrl} className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-control bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-contrast transition-opacity hover:opacity-90">سجّل مع هذا المعلّم<ProfileIcon name="arrow" className="h-5 w-5 shrink-0" /></Link>
            <p className="mt-3 flex items-center justify-center gap-2 text-xs text-ink-muted"><ProfileIcon name="check" className="h-4 w-4" /> التسجيل مرتبط بهذا المعلّم فقط</p>
            <dl className="mt-6 space-y-3 border-t border-line pt-5 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">الدورات المنشورة</dt><dd className="font-semibold text-ink">{profile.courses.length.toLocaleString("ar")}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">الانضمام للمساحة</dt><dd className="font-semibold text-ink">يتطلّب موافقة المعلّم</dd></div>
            </dl>
          </Card>
          <Card className="profile-explore-card">
            <p className="text-sm font-semibold text-ink">ما زلت تستكشف وجهتك؟</p>
            <p className="mt-2 text-xs leading-relaxed text-ink-secondary">تعرّف على بقيّة المعلّمين قبل أن تختار مساحة التعلّم المناسبة لك.</p>
            <Link to="/teachers" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">العودة إلى دليل المعلّمين<ProfileIcon name="arrow" className="h-4 w-4" /></Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
