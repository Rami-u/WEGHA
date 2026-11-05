import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { listPublicTeachers } from "../../api/public";
import { Alert, Button, Card, EmptyState, Input, PageHeader, PaginationControls, Spinner, WorkspaceLogo } from "../../components/ui";
import { useApiErrorText } from "../../lib/apiErrorText";
import { ApiError } from "../../lib/apiClient";
import { subdomainUrl } from "../../lib/slug";
import type { PublicTeacherDirectoryEntry } from "../../types/api";
import "./teacher-directory.css";

/** Teacher directory on the main site: listed and active workspaces only, searchable and paginated. */

const PAGE_SIZE = 20;

function DirectoryIcon({ name, className = "h-5 w-5" }: { name: "book" | "search" | "arrow" | "close"; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {name === "book" && <><path d="M3 4.5c3-1 6-1 9 1v15c-3-2-6-2-9-1v-15Z" /><path d="M12 5.5c3-2 6-2 9-1v15c-3-1-6-1-9 1v-15Z" /></>}
      {name === "search" && <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>}
      {name === "arrow" && <path d="M20 12H4m7-7-7 7 7 7" />}
      {name === "close" && <path d="m6 6 12 12M6 18 18 6" />}
    </svg>
  );
}

function teacherTone(slug: string): number {
  let hash = 2166136261;
  for (const char of slug) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % 4;
}

export function TeacherDirectoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get("search") ?? "";
  const requestedPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [entries, setEntries] = useState<PublicTeacherDirectoryEntry[]>([]);
  const [count, setCount] = useState(0);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [previousUrl, setPreviousUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(searchTerm);
  const [retry, setRetry] = useState(0);

  const errorToText = useApiErrorText();

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorText(null);
      try {
        const response = await listPublicTeachers({ search: searchTerm || undefined, page });
        if (cancelled) return;
        setEntries(response.results);
        setCount(response.count);
        setNextUrl(response.next);
        setPreviousUrl(response.previous);
      } catch (error) {
        if (!cancelled) setErrorText(errorToText(error as ApiError, "تعذّر تحميل دليل المعلّمين."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [searchTerm, page, retry, errorToText]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const term = searchInput.trim();
    setSearchParams(term ? { search: term } : {});
  }

  return (
    <div className="teacher-directory">
      <div className="mb-6 flex items-center gap-3 text-xs text-ink-muted">
        <Link to="/" className="transition-colors hover:text-accent">الرئيسية</Link>
        <span aria-hidden>/</span>
        <span className="text-ink" aria-current="page">دليل المعلّمين</span>
      </div>

      <section className="relative overflow-hidden rounded-panel border border-line bg-section p-6 sm:p-10">
        <div className="relative z-10 grid items-center gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <span className="mb-5 inline-flex items-center gap-2 rounded-pill border border-accent/15 bg-surface/70 px-3 py-1 text-xs font-medium text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              تعلّم يبدأ باختيارك
            </span>
            <div className="[&_h1]:text-3xl [&_h1]:font-extrabold sm:[&_h1]:text-4xl [&_h1]:leading-relaxed [&_p]:max-w-lg [&_p]:text-sm">
              <PageHeader title="معلّمك المناسب، بداية وجهتك." subtitle="تعرّف على المعلّمين، واستكشف مساحاتهم. اختر من يرافق رحلتك، ثم سجّل معه مباشرة." />
            </div>
            <span className="inline-flex items-center gap-2 text-xs text-ink-secondary">
              <DirectoryIcon name="book" className="h-4 w-4 text-accent" />
              لكل معلّم مساحة تعلّم مستقلة
            </span>
          </div>
        </div>
      </section>

      <form onSubmit={submitSearch} role="search" className="mt-8 flex flex-col gap-3 rounded-panel border border-line bg-surface p-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-ink-muted">
            <DirectoryIcon name="search" />
          </span>
          <Input
            type="search"
            placeholder="ابحث باسم المعلّم أو مساحته..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="البحث في دليل المعلّمين"
            className="h-12 border-transparent bg-transparent ps-12"
          />
        </div>
        <Button type="submit" size="lg" className="shrink-0 sm:px-8">ابحث عن معلّمك<DirectoryIcon name="arrow" /></Button>
      </form>

      <div className="mb-6 mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-lg font-bold text-ink">{searchTerm ? "نتائج البحث" : "تعرّف على المعلّمين"}</p>
          {!loading && !errorText && <span className="rounded-pill bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">{count.toLocaleString("ar")} معلّم</span>}
          {searchTerm && (
            <Button variant="ghost" size="sm" onClick={() => setSearchParams({})} aria-label="مسح البحث">
              <span className="max-w-40 truncate">{searchTerm}</span><DirectoryIcon name="close" className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-ink-muted">تصفّح المساحات قبل التسجيل، دون الحاجة لحساب</p>
      </div>

      <div aria-busy={loading} aria-live="polite">
      {loading ? (
        <div className="flex justify-center rounded-panel border border-line bg-surface py-20"><Spinner className="h-8 w-8" /></div>
      ) : errorText ? (
        <div className="space-y-4">
          <Alert tone="error">{errorText}</Alert>
          <Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>إعادة المحاولة</Button>
        </div>
      ) : entries.length === 0 ? (
        <div className="space-y-4">
          <EmptyState title="لم نعثر على معلّم مطابق" hint="جرّب اسمًا آخر أو امسح البحث لاستعراض جميع المعلّمين." />
          {(searchTerm || page > 1) && <Button variant="secondary" onClick={() => setSearchParams({})}>عرض جميع المعلّمين</Button>}
        </div>
      ) : (
        <>
          <ul
            className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="نتائج دليل المعلّمين"
          >
            {entries.map((entry) => (
              <li key={entry.slug} className={`directory-tone-${teacherTone(entry.slug)} min-w-0`}>
                <Card className="directory-teacher-card flex h-full flex-col overflow-hidden p-0 transition-all duration-200 hover:-translate-y-1 hover:shadow-card">
                  <div className="directory-teacher-cover relative h-24 shrink-0">
                    <span className="absolute start-4 top-4 rounded-pill bg-surface/75 px-2.5 py-1 text-xs text-ink-secondary">مساحة مستقلة</span>
                    <DirectoryIcon name="book" className="absolute bottom-3 end-4 h-14 w-14 -rotate-12 opacity-20" />
                    <div className="directory-teacher-avatar absolute -bottom-8 start-5 rounded-full bg-surface p-1">
                      <WorkspaceLogo src={entry.logo} name={entry.teacher_name || entry.name} size={64} />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col px-5 pb-5 pt-11">
                    <p className="text-lg font-bold text-ink">{entry.teacher_name || entry.name}</p>
                    <p dir="ltr" className="mt-1 text-end text-xs text-ink-muted">@{entry.slug}</p>
                    <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-ink-secondary">{entry.headline || "تعرّف على المعلّم واستكشف مساحته التعليمية."}</p>
                    <p className="mb-5 mt-4 truncate border-t border-line pt-3 text-xs text-ink-muted" title={entry.name}>{entry.name}</p>
                    <div className="mt-auto space-y-2">
                      <Link to={`/teachers/${entry.slug}`} className="flex h-10 items-center justify-center rounded-control border border-line text-sm font-semibold text-accent transition-colors hover:bg-soft">تعرّف على المعلّم</Link>
                      <Link reloadDocument to={subdomainUrl(entry.slug, "/signup")} className="flex h-10 items-center justify-center gap-2 rounded-control bg-accent text-sm font-semibold text-accent-contrast transition-opacity hover:opacity-90">تعلّم مع المعلّم<DirectoryIcon name="arrow" className="h-4 w-4" /></Link>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          {count > PAGE_SIZE && (
          <PaginationControls
            page={page}
            count={count}
            pageSize={PAGE_SIZE}
            hasPrevious={previousUrl !== null && page > 1}
            hasNext={nextUrl !== null}
            onPrevious={() => setSearchParams({ ...(searchTerm ? { search: searchTerm } : {}), page: String(page - 1) })}
            onNext={() => setSearchParams({ ...(searchTerm ? { search: searchTerm } : {}), page: String(page + 1) })}
          />
          )}
        </>
      )}
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-xs text-ink-muted">
        <p>اختر معلّمك ← سجّل في مساحته ← ابدأ رحلتك</p>
        <Link to="/#how" className="inline-flex items-center gap-2 font-semibold text-accent hover:underline">كيف تبدأ؟<DirectoryIcon name="arrow" className="h-4 w-4" /></Link>
      </div>
    </div>
  );
}
