import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { listPublicTeachers } from "../../api/public";
import { Button, FullPageSpinner, Input, Select } from "../../components/ui";
import { subdomainUrl } from "../../lib/slug";
import type { PublicTeacherDirectoryEntry } from "../../types/api";

/*
  وجهة landing (per the approved design):
  1. Hero with the photo composition and floating cards
  2. Feature strip
  3. Teacher preview cards (real directory data, client-side filters)
  4. Steps band
  5. FAQ accordion
  6. Dark closing CTA
  Copy stays truthful to what the product actually does today.
*/

const TILES = ["teal", "blue", "sand", "purple"] as const;
type TileKey = (typeof TILES)[number];

function tileFor(slug: string): TileKey {
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TILES[hash % TILES.length];
}

function toArabicDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

/** Client-side category filter: matches the keyword against the workspace text. */
const CATEGORIES: { label: string; keywords: string[] }[] = [
  { label: "الكل", keywords: [] },
  { label: "التصميم", keywords: ["تصميم"] },
  { label: "البرمجة", keywords: ["برمجة", "برمجيات", "كود"] },
  { label: "الرياضيات", keywords: ["رياضيات", "جبر", "تفاضل"] },
  { label: "اللغات", keywords: ["لغة", "لغات", "إنجليزي", "عربي"] },
  { label: "الأعمال", keywords: ["أعمال", "إدارة", "مشاريع"] },
  { label: "تحليل البيانات", keywords: ["بيانات", "تحليل", "إحصاء"] },
  { label: "العلوم", keywords: ["علوم", "فيزياء", "كيمياء", "أحياء"] },
  { label: "الهوايات", keywords: ["هوايات", "موسيقى", "رسم", "خط"] },
  { label: "المهارات المهنية", keywords: ["مهارات", "مهني"] },
];

const FEATURE_STRIP = [
  { label: "معلمون مختصون", icon: "book" },
  { label: "مساحة خاصة لكل معلّم", icon: "grid" },
  { label: "تعلّم مباشر مع معلّمك", icon: "person" },
  { label: "تقدّم مستقر مع كل معلّم", icon: "chart" },
] as const;

const STEPS = [
  {
    title: "اختر معلّمك",
    body: "تعرّف على المعلّمين وابحث عن التخصص الذي تريد تعلّمه.",
    icon: "grid" as const,
  },
  {
    title: "سجّل في مساحة المعلّم",
    body: "أنشئ حسابك من صفحة معلّمك، وانضم إلى طلابه في مساحته الخاصة.",
    icon: "book" as const,
  },
  {
    title: "شاهد أثر تعلّمك",
    body: "أكمل الدروس، اختبر معرفتك، وراجع نتائجك وتقدّمك.",
    icon: "chart" as const,
  },
];

const FAQS = [
  {
    q: "ما هي وجهة؟",
    a: "منصّة عربية تضع لكل معلّم مساحة تعلّم مستقلة بعنوانه الخاص، فيها حسابه وطلابه ودوراته.",
  },
  {
    q: "كيف أسجّل مع معلّم؟",
    a: "اختر معلّمك من الدليل، ثم أنشئ حسابًا في مساحته الخاصة. الدخول يبدأ بعد موافقة المعلّم على طلبك.",
  },
  {
    q: "هل يمكنني الاشتراك مع أكثر من معلّم؟",
    a: "نعم. لكل معلّم مساحة وحساب مستقل، ولك كلمة مرور وطلب موافقة داخل كل مساحة.",
  },
  {
    q: "أين يُحفظ تقدّمي؟",
    a: "تسجيلاتك ودوراتك محفوظة في مساحة المعلّم نفسها، وتظهر لك في حسابك بعد الموافقة.",
  },
];

/* ---------- Small inline stroke icons (consistent with the UI set) ---------- */

function Icon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    book: (
      <>
        <path d="M3 4.5c3-1 6-1 9 1v15c-3-2-6-2-9-1v-15Z" />
        <path d="M12 5.5c3-2 6-2 9-1v15c-3-1-6-1-9 1v-15Z" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    person: (
      <>
        <circle cx="12" cy="7.5" r="3.5" />
        <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
      </>
    ),
    chart: (
      <>
        <path d="M3 3v18h18" />
        <path d="M8 17v-6m5 6V7m5 10V4" />
      </>
    ),
    "arrow-left": <path d="M20 12H4m7-7-7 7 7 7" />,
    "arrow-up": <path d="M12 20V4m-7 7 7-7 7 7" />,
    star: <path d="M12 3.5l2.3 4.7 5.2.7-3.8 3.6.9 5.1L12 15.2l-4.6 2.4.9-5.1-3.8-3.6 5.2-.7L12 3.5Z" />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    chevron: <path d="M6 9l6 6 6-6" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}

export function LandingPage() {
  const [entries, setEntries] = useState<PublicTeacherDirectoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(0);
  const [sortBy, setSortBy] = useState<"default" | "name">("default");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 320);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorText(null);
      try {
        const response = await listPublicTeachers();
        if (!cancelled) {
          setEntries(response.results);
          setTotal(response.count);
        }
      } catch {
        if (!cancelled) setErrorText("تعذّر تحميل دليل المعلّمين. حاول بعد قليل.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCategory = CATEGORIES[category];

  const visible = useMemo(() => {
    const term = search.trim();
    let list = entries;
    if (activeCategory.keywords.length > 0) {
      list = list.filter((entry) => {
        const haystack = `${entry.name} ${entry.teacher_name ?? ""} ${entry.headline ?? ""}`;
        return activeCategory.keywords.some((k) => haystack.includes(k));
      });
    }
    if (term) {
      list = list.filter((entry) =>
        `${entry.name} ${entry.teacher_name ?? ""} ${entry.headline ?? ""}`.includes(term),
      );
    }
    if (sortBy === "name") {
      list = [...list].sort((a, b) => (a.teacher_name ?? a.name).localeCompare(b.teacher_name ?? b.name, "ar"));
    }
    return list;
  }, [entries, activeCategory, search, sortBy]);

  function categoriesFor(entry: PublicTeacherDirectoryEntry): string[] {
    const haystack = `${entry.name} ${entry.teacher_name ?? ""} ${entry.headline ?? ""}`;
    return CATEGORIES.filter(
      (c) => c.keywords.length > 0 && c.keywords.some((k) => haystack.includes(k)),
    ).map((c) => c.label);
  }

  return (
    <div className="divide-y divide-line">
      {/* ---------- 1. Hero ---------- */}
      <section className="landing-hero">
        <div className="hero-copy">
          <p className="hero-eyebrow">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            لكل فضول، بداية جديدة
          </p>
          <h1 className="hero-title">
            تعلّم اليوم.
            <br />
            <span className="hero-title-line">
              حدّد <span className="text-accent">وجهتك</span><span className="hero-period">.</span>
              <span
                aria-hidden
                className="hero-underline"
              />
            </span>
          </h1>
          <p className="hero-description">
            تعلّم مع معلّم يفهم رحلتك.
            <br />
            اختر معلّمك، وانضم إلى مساحته الخاصة،
            <br />
            لتخطو بثقة نحو ما تريد أن تكون.
          </p>
          <div className="hero-action">
            <Link to="/teachers">
              <Button size="lg" className="hero-cta">
                ابدأ رحلتك
                <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 12H4m7-7-7 7 7 7" />
                </svg>
              </Button>
            </Link>
          </div>
          <p className="hero-note">
            <Icon name="check" className="h-4 w-4" />
            اختر معلّمك أولًا، ثم سجّل معه وتابع حتى الاعتماد.
          </p>
          <p className="hero-tagline">
            <span aria-hidden className="h-px w-8 bg-line" />
            رحلة تعلّم أوضح. آفاق أوسع.
          </p>
        </div>

        {/* Photo composition with floating cards (decorative) */}
        <div className="hero-art" aria-hidden>
          <span className="hero-plus">+</span>
          <div className="hero-photo-stage">
            <span className="hero-outline" />
            <div className="hero-photo">
              <img
                src="/images/hero-student.jpg"
                alt=""
                className="hero-image"
                loading="eager"
              />
              <div className="hero-photo-caption">
                <p>كل يوم، فرصة جديدة.</p>
                <p>خطوتك القادمة تبدأ هنا.</p>
              </div>
            </div>

            <div className="hero-goal-card">
              <span className="hero-goal-check">
                <Icon name="check" />
              </span>
              <div className="hero-goal-text">
                <p>خطوة أقرب إلى هدفك</p>
                <p>كل درس يصنع فرقًا.</p>
              </div>
              <span className="hero-goal-star">
                <Icon name="star" className="h-5 w-5" />
              </span>
            </div>

            <div className="hero-knowledge-card">
              <span className="hero-knowledge-icon">
                <Icon name="book" className="h-7 w-7" />
              </span>
              <div className="hero-knowledge-content">
                <p>تعلّم على مهل، وتقدّم بثقة.</p>
                <p>شاهد كيف تُبنى معرفتك</p>
                <span className="hero-progress"><span /></span>
              </div>
            </div>
          </div>
          <p className="hero-art-caption">تعلّم. اكتشف. تقدّم.</p>
        </div>
      </section>

      {/* ---------- 2. Feature strip ---------- */}
      <section className="py-10">
        <div className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-5">
          <p className="text-sm font-semibold leading-[1.8] text-ink">
            مهما كانت رحلتك، هناك معلّم يناسبك.
          </p>
          {FEATURE_STRIP.map((item) => (
            <span key={item.label} className="flex items-center gap-2.5 text-sm font-medium text-ink-secondary">
              <Icon name={item.icon} className="h-5 w-5 text-ink-muted" />
              {item.label}
            </span>
          ))}
        </div>
      </section>

      {/* ---------- 3. Teachers preview (real data) ---------- */}
      <section id="teachers" className="scroll-mt-24 py-12">
        <p className="text-sm text-ink-muted">المعلّمون المتميّزون، بداية مختلفة</p>
        <h2 className="mt-2 text-[clamp(28px,3vw,36px)] font-extrabold leading-[1.4] text-ink">
          اختر من يرافق رحلة تعلّمك.
        </h2>
        <p className="mt-2 text-sm leading-[1.8] text-ink-secondary">
          تعرّف على المعلمين واختر تخصصك، ثم سجّل في مساحة معلّمك.
        </p>

        <div className="mt-6 max-w-xl">
          <Input
            type="search"
            placeholder="ابحث باسم المعلم أو التخصص..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="البحث في دليل المعلّمين"
          />
        </div>

        <ul className="mt-5 flex flex-wrap gap-2" aria-label="التصنيفات">
          {CATEGORIES.map((item, index) => (
            <li key={item.label}>
              <button
                type="button"
                onClick={() => setCategory(index)}
                aria-pressed={category === index}
                className={
                  "rounded-full border px-4 py-2 text-xs font-semibold transition-all " +
                  (category === index
                    ? "border-accent bg-accent text-accent-contrast"
                    : "border-line bg-surface text-ink-secondary hover:border-accent/50 hover:text-ink")
                }
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-muted">ترتيب حسب</span>
            <Select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as "default" | "name")}
              className="w-44"
              aria-label="ترتيب المعلمين"
            >
              <option value="default">الترتيب الافتراضي</option>
              <option value="name">اسم المعلّم</option>
            </Select>
          </div>
          <span className="text-xs text-ink-muted">
            نعرض {toArabicDigits(visible.length)} من {toArabicDigits(total)} معلمين
          </span>
        </div>

        {errorText ? (
          <p className="mt-8 text-sm text-err">{errorText}</p>
        ) : loading ? (
          <FullPageSpinner />
        ) : visible.length === 0 ? (
          <p className="mt-10 text-center text-sm text-ink-secondary">لا توجد مساحات مطابقة في هذا الترشيح بعد.</p>
        ) : (
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-live="polite">
            {visible.map((entry) => (
              <TeacherPreviewCard key={entry.slug} entry={entry} subjects={categoriesFor(entry)} />
            ))}
          </ul>
        )}

        <div className="teacher-discovery-footer">
          <Link to="/teachers">
            <Button variant="secondary" size="lg" className="teacher-discovery-button">
              استكشف جميع المعلمين
              <Icon name="arrow-left" className="h-5 w-5" />
            </Button>
          </Link>
          <p>
            أسماء المعلمين وعناوينهم من الدليل الفعلي للمنصّة — استعرض الملفات الكاملة في دليل المعلمين.
          </p>
        </div>
      </section>

      {/* ---------- 4. Steps ---------- */}
      <section id="how" className="landing-journey" aria-labelledby="journey-heading">
        <div className="journey-copy">
          <p className="journey-eyebrow">من البداية إلى الإنجاز</p>
          <h2 id="journey-heading" className="journey-title">
            طريق واضح.
            <br />
            خطوة بعد خطوة.
          </h2>
          <p className="journey-description">
            لا تحتاج أن تعرف كل شيء لتبدأ.
            <br />
            تحتاج فقط أن تختار خطوتك الأولى.
          </p>
          <Link to="/teachers" className="journey-action">
            <Button size="lg" className="journey-button">
              اكتشف المعلمين
              <Icon name="arrow-left" className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        <ol className="journey-steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="journey-step">
              <span className="journey-step-number" aria-hidden>{toArabicDigits(index + 1).padStart(2, "٠")}</span>
              <div className="journey-step-copy">
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
              <span className="journey-step-icon">
                <Icon name={step.icon} className="h-7 w-7" />
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- 5. FAQ ---------- */}
      <section id="faq" className="landing-faq">
        <p className="text-center text-sm text-ink-muted">قبل خطوتك الأولى</p>
        <h2 className="mt-2 text-center text-[clamp(28px,3vw,36px)] font-extrabold leading-[1.4] text-ink">
          قد تتساءل…
        </h2>
        <p className="mt-2 text-center text-sm text-ink-secondary">إجابات بسيطة لتبدأ بثقة.</p>

        <div className="landing-faq-items">
          {FAQS.map((faq) => (
            <details key={faq.q} className="landing-faq-item">
              <summary>
                {faq.q}
                <Icon
                  name="chevron"
                  className="faq-chevron"
                />
              </summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------- 6. Closing CTA ---------- */}
      <section className="landing-closing" aria-labelledby="closing-heading">
        <div className="closing-panel">
          <span className="closing-watermark" aria-hidden>
            <Icon name="book" className="closing-book" />
          </span>
          <p className="closing-eyebrow">المعرفة تفتح أبوابًا جديدة</p>
          <h2 id="closing-heading" className="closing-title">
            أفقك القادم يبدأ بخطوة.
          </h2>
          <p className="closing-description">
            ابدأ رحلتك مع وجهة، واجعل فضولك يقودك إلى المزيد.
          </p>
          <Link to="/teachers" className="closing-action">
            <Button variant="secondary" size="lg" className="closing-button">
              ابدأ رحلتك الآن
              <Icon name="arrow-left" className="h-5 w-5" />
            </Button>
          </Link>
          <p className="closing-note">اختر معلّمك وتابع إلى مساحته الخاصة للتسجيل والالتحاق بدوراته.</p>
        </div>
      </section>

      {/* Back to top */}
      {scrolled && (
        <Button
          variant="secondary"
          type="button"
          onClick={() => window.scrollTo({
            top: 0,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          })}
          className="landing-back-top"
          aria-label="العودة إلى الأعلى"
        >
          <Icon name="arrow-up" className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}

/* ---------- One teacher preview card ---------- */

function TeacherPreviewCard({
  entry,
  subjects,
}: {
  entry: PublicTeacherDirectoryEntry;
  subjects: string[];
}) {
  const tile = tileFor(entry.slug);
  const title = entry.teacher_name || entry.name;

  return (
    <li className="flex h-full min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface transition-all duration-200 ease-[var(--ease-standard)] hover:-translate-y-1 hover:shadow-card">
      {/* Tinted cover with watermark + optional subject chip */}
      <div
        className="relative flex h-24 shrink-0 items-center justify-center"
        style={{ background: `var(--tile-${tile}-bg)` }}
      >
        {subjects[0] && (
          <span className="absolute top-3 start-3 rounded-full bg-surface/85 px-2.5 py-0.5 text-[11px] font-semibold text-ink">
            {subjects[0]}
          </span>
        )}
        <Icon name="grid" className="absolute -start-6 bottom-[-14px] h-24 w-24 text-black/[0.04]" />
        {/* Avatar circle overlapping the cover bottom */}
        <div className="absolute -bottom-9">
          {entry.logo ? (
            <img
              src={entry.logo}
              alt={`شعار ${entry.name}`}
              className="h-[72px] w-[72px] rounded-full border-4 border-surface object-cover"
              loading="lazy"
            />
          ) : (
            <span
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-surface text-2xl font-bold"
              style={{
                color: `var(--tile-${tile}-fg)`,
                background: `var(--tile-${tile}-bg)`,
                borderColor: "var(--surface)",
              }}
            >
              {title.trim().charAt(0) || "؟"}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-12">
        <p className="min-w-0 truncate text-center text-lg font-extrabold text-ink">{title}</p>
        {entry.headline && (
          <p className="mt-2 line-clamp-2 min-h-[3.4em] text-center text-sm leading-[1.8] text-ink-secondary">
            {entry.headline}
          </p>
        )}

        <div className="mt-4 space-y-2 border-t border-line pt-4">
          {entry.name !== title && (
            <p className="flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-muted">المساحة</span>
              <span className="min-w-0 truncate font-semibold text-ink">{entry.name}</span>
            </p>
          )}
          <p className="flex items-center justify-between gap-2 text-xs">
            <span className="text-ink-muted">الموقع</span>
            <span dir="ltr" className="min-w-0 truncate font-medium text-ink-secondary">
              {entry.slug}.{location.hostname.includes("localhost") ? "localhost" : "edunova.com"}
            </span>
          </p>
        </div>

        <div className="mt-auto pt-4">
          <Link
            to={`/teachers/${entry.slug}`}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-control border border-line bg-surface text-sm font-semibold text-accent transition-colors hover:bg-soft"
          >
            تعرّف على المعلم
            <span aria-hidden>←</span>
          </Link>
          <a
            href={subdomainUrl(entry.slug, "/signup")}
            className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-control bg-accent text-sm font-semibold text-accent-contrast transition-opacity hover:opacity-90"
          >
            تعلّم مع المعلم
            <span aria-hidden>←</span>
          </a>
        </div>
      </div>
    </li>
  );
}
