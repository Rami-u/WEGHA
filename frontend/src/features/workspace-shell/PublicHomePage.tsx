import { Link } from "react-router-dom";

import { Button, Card, CourseCover, EmptyState, PageHeader, PriceTag, FullPageSpinner, WorkspaceLogo } from "../../components/ui";
import { AuthIcon } from "../../components/WorkspaceAuth";
import { useSession } from "../../context/SessionContext";
import { mainSiteUrl } from "../../lib/slug";

/**
 * Home of a teacher's sub-domain: identity and published courses from the
 * public-profile endpoint. Signed-out visitors see registration CTAs,
 * signed-in members see links to their portal.
 */
export function PublicHomePage() {
  const { publicProfile, workspace, user, booting, refreshWorkspace } = useSession();

  if (booting) {
    return <FullPageSpinner />;
  }

  if (!publicProfile) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <PageHeader title={workspace?.name ?? "مرحبًا بك في مساحة المعلّم"} subtitle="تعذّر عرض التفاصيل العامة حاليًا. يمكنك إعادة المحاولة أو العودة إلى الصفحة الرئيسية." />
        <Button variant="secondary" onClick={() => void refreshWorkspace()}>إعادة تحميل التفاصيل</Button>
        {!user && <div className="mt-6 flex flex-wrap justify-center gap-3"><Link to="/signup" className="rounded-control bg-accent px-4 py-3 text-sm font-semibold text-accent-contrast">إنشاء حساب</Link><Link to="/login" className="rounded-control border border-line px-4 py-3 text-sm font-semibold text-accent">تسجيل الدخول</Link></div>}
      </Card>
    );
  }

  const teacherName = publicProfile.teacher_name || publicProfile.name;
  const teacherProfileUrl = new URL(`${mainSiteUrl()}teachers/${encodeURIComponent(publicProfile.slug)}`, window.location.origin).href;

  return (
    <div className="workspace-home">
      <div className="mb-6 flex items-center gap-2 text-xs text-ink-muted"><AuthIcon className="h-4 w-4 text-accent" />وجهة<span aria-hidden>/</span><span className="text-ink">مساحة المعلّم</span></div>
      <Card className="workspace-welcome overflow-hidden">
        <div className="relative overflow-hidden bg-panel p-6 text-panel-fg sm:p-10">
          <AuthIcon className="pointer-events-none absolute -bottom-8 end-8 h-64 w-64 -rotate-12 text-panel-fg/5" />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row">
            <WorkspaceLogo src={publicProfile.logo} name={teacherName} size={64} />
            <div className="min-w-0 flex-1">
              <p className="mb-3 text-xs font-semibold text-panel-fg/65">مساحتك للتعلّم، مع معلّمك</p>
              <div className="[&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:leading-relaxed [&_h1]:text-panel-fg sm:[&_h1]:text-4xl [&_p]:text-panel-fg/75">
                <PageHeader title={publicProfile.name} subtitle={publicProfile.headline ?? "استكشف الدورات، وتعرّف على مساحة التعلّم الخاصة بمعلّمك."} />
              </div>
              <p className="text-sm text-panel-fg/75">بإشراف {teacherName}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to={user ? "/courses" : "/signup"} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-control bg-accent px-6 py-3 text-sm font-semibold text-accent-contrast hover:opacity-90">{user ? "الدخول إلى دوراتي" : "انضم إلى هذه المساحة"}<AuthIcon name="arrow" /></Link>
                <Link reloadDocument to="#workspace-courses" className="inline-flex min-h-12 items-center justify-center rounded-control border border-panel-fg/25 px-5 py-3 text-sm font-semibold text-panel-fg hover:bg-panel-fg/5">استكشف الدورات</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 text-xs text-ink-secondary sm:px-10">
          <span className="inline-flex items-center gap-2"><AuthIcon className="h-4 w-4 text-accent" />{publicProfile.courses.length.toLocaleString("ar")} دورة منشورة</span>
          <span>حسابك ودوراتك داخل مساحة هذا المعلّم فقط</span>
          <Link reloadDocument to={teacherProfileUrl} className="font-semibold text-accent hover:underline">الملف العام للمعلّم</Link>
        </div>
      </Card>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <p role="heading" aria-level={2} className="mb-4 text-lg font-bold text-ink">تعلّم أقرب إلى معلّمك</p>
            <p className="whitespace-pre-line text-sm leading-loose text-ink-secondary">{publicProfile.bio || "تعرّف على المعلّم ودوراته، ثم اختر ما يناسب رحلتك التعليمية."}</p>
            {publicProfile.about && <p className="mt-4 whitespace-pre-line border-t border-line pt-4 text-sm leading-loose text-ink-secondary">{publicProfile.about}</p>}
          </Card>
          <section id="workspace-courses" className="scroll-mt-6" aria-label="دورات المعلّم">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p role="heading" aria-level={2} className="text-xl font-bold text-ink">اختر خطوتك التالية</p>
              <span className="rounded-pill bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">{publicProfile.courses.length.toLocaleString("ar")} دورة</span>
            </div>
            <p className="mb-5 text-sm text-ink-secondary">استعرض تفاصيل الدورات المنشورة قبل الانضمام إليها.</p>
            {publicProfile.courses.length === 0 ? (
              <Card className="text-center">
                <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent"><AuthIcon className="h-7 w-7" /></span>
                <EmptyState title="الدورات قيد الانتظار" hint="لم ينشر هذا المعلّم دورات بعد. ستظهر الدورات وتفاصيلها هنا عندما ينشرها." />
              </Card>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {publicProfile.courses.map((course) => (
                  <li key={course.id} className="min-w-0">
                    <Card className="flex h-full flex-col">
                      <div className="mb-5 flex items-center justify-between gap-3"><CourseCover courseId={course.id} title={course.title} /><PriceTag price={course.price} className="text-sm" /></div>
                      <p className="font-bold leading-relaxed text-ink">{course.title}</p>
                      <details className="workspace-course mb-5 mt-4">
                        <summary className="cursor-pointer text-xs font-semibold text-accent">عرض وصف الدورة</summary>
                        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-secondary">{course.description || "لم يُضف وصف لهذه الدورة بعد."}</p>
                      </details>
                      <Link to={user ? `/courses/${course.id}` : "/signup"} className="mt-auto flex min-h-10 items-center justify-center gap-2 rounded-control border border-line px-3 py-2 text-xs font-semibold text-accent hover:bg-soft">{user ? "افتح الدورة" : "أنشئ حسابًا للانضمام"}<AuthIcon name="arrow" className="h-4 w-4" /></Link>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-6" aria-label="كيفية بدء التعلّم">
          <Card>
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-card bg-accent-soft text-accent"><AuthIcon /></span>
            <p role="heading" aria-level={2} className="text-lg font-extrabold text-ink">ابدأ بخطوات واضحة</p>
            <ol className="my-6 space-y-5">
              {[{ title: "أنشئ حسابك", text: "سجّل بياناتك في هذه المساحة." }, { title: "انتظر قبول المعلّم", text: "تتم مراجعة طلبك قبل إتاحة الدخول." }, { title: "اختر دورتك", text: "استعرض الدورات وانضم لما يناسبك." }].map((step, index) => (
                <li key={step.title} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{(index + 1).toLocaleString("ar")}</span><div><p className="text-sm font-semibold text-ink">{step.title}</p><p className="mt-1 text-xs leading-relaxed text-ink-secondary">{step.text}</p></div></li>
              ))}
            </ol>
            {user ? <Link to="/courses" className="block rounded-control bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-contrast">اذهب إلى دوراتي</Link> : <><Link to="/signup" className="block rounded-control bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-contrast hover:opacity-90">إنشاء حساب طالب</Link><p className="mt-4 text-center text-xs text-ink-secondary">لديك حساب مقبول؟ <Link to="/login" className="font-semibold text-accent hover:underline">سجّل الدخول</Link></p></>}
          </Card>
          <div className="rounded-card border border-line bg-section p-5 text-xs leading-relaxed text-ink-secondary">
            <p className="mb-2 font-bold text-ink">لكل معلّم مساحة مستقلة</p>
            <p>تسجيلك هنا مرتبط بهذه المساحة، ولا يعني الاشتراك تلقائيًا في جميع الدورات أو مساحات المعلّمين الآخرين.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
