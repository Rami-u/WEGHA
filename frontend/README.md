# Edunova frontend (وجهة design)

One React SPA that serves the **main domain** (marketing + teacher directory) and every
**teacher sub-domain** (student and teacher workspace). The workspace slug is read from
the hostname: `drahmed.edunova.com` → requests go to `/api/v1/workspaces/drahmed/...`.

Stack: Vite + React 19 + TypeScript + React Router 7 + Tailwind CSS 4.

## Visual design (DESIGN.md)

The UI follows the **وجهة / Wajha** design system in `D:\WEGHA\DESIGN.md`:

- **Arabic RTL everywhere** — `<html lang="ar" dir="rtl">` in `index.html`; logical
  utilities (`ms/me/ps/pe/start/end`) only. Tajawal loads from local TTFs at
  `public/fonts/tajawal/` (`@font-face` in `src/index.css` — no Google Fonts request).
  In production Django's SPA view serves them from the dist tree with revalidation.
- **Tokens** — all colors/radii/shadows are CSS custom properties in `src/index.css`
  (`:root` light, `.dark` dark) mapped with `@theme inline` to utilities such as
  `bg-page`, `bg-landing`, `bg-surface`, `bg-soft`, `text-ink`, `text-accent`,
  `bg-accent-soft`, `border-line`, `text-success`, `bg-warn-bg`, `text-err`, and
  radii `rounded-control` (7px) / `rounded-card` (11px) /
  `rounded-panel` (15px) / `rounded-pill`, plus `shadow-card` / `shadow-elevated`.
- **Dark mode** — an inline script in `index.html` applies `.dark` on `<html>` before
  React mounts (system preference until the user chooses; stored under the
  `wajha-theme` localStorage key). The sun/moon toggle lives in
  `src/components/ThemeToggle.tsx`, syncs between tabs via the `storage` event.
- **Motion** — `var(--ease-standard)` = cubic-bezier(0.2,0.7,0.3,1), 180–300ms;
  `prefers-reduced-motion` collapses all movement. Resting cards are border-only;
  shadows appear on hover/elevation only.
- **Focus** — global `:focus-visible` outline: 3px accent with a 3–4px offset.
- Landing pages use the warm `bg-landing` canvas and deep-teal `bg-panel` sections;
  the signed-in portal uses `bg-page`. Course covers pick one of four subject accents
  (`CourseCover` in `src/components/ui.tsx`).

## Run it (development)

1. **Backend first** — from `backend/` with the virtualenv active:
   ```
   python manage.py runserver
   ```
   and make sure two lines are in `backend/.env` (dev only):
   ```
   DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,testserver
   CSRF_TRUSTED_ORIGINS=https://*.edunova.com,http://*.localhost:5173
   ```

2. **Frontend** — from `frontend/`:
   ```
   npm install
   copy .env.example .env        # (Windows) keep VITE_PLATFORM_BASE_DOMAIN in sync with the backend
   npm run dev
   ```

3. **Open it** (no DNS or hosts edits needed — browsers resolve `*.localhost`):
   - Main site:    `http://localhost:5173`
   - A workspace:  `http://drahmed.localhost:5173` (use any workspace slug from your database)
   - Teacher sign-in (private): `http://drahmed.localhost:5173/teacher/login`
   - Invitation / student reset links point at `/teacher/set-password/?uid=…&token=…`
     and `/reset-password/?uid=…&token=…` on the sub-domain.

The Vite dev server proxies `/api` and `/media` to `http://127.0.0.1:8000`, so Django
session cookies stay same-origin and host-only on every host.

## Build

```
npm run build       # type-check (tsc --noEmit) then vite build
npm run preview
```

`VITE_PLATFORM_BASE_DOMAIN` (from `.env.local` or the shell) is **compiled into the bundle at
build time**. Development builds use `localhost`; a production build must be made with the real
platform domain, e.g. `VITE_PLATFORM_BASE_DOMAIN=edunova.com npm run build`, so workspace links
resolve to `<slug>.edunova.com` in the deployed UI. See `docs/deployment.md` (single-origin
serving: set `FRONTEND_DIST=frontend/dist` in the backend and Django serves this bundle
alongside the API).

## Map to the backend (stages 1–9)

| Feature area | File | Endpoints |
|---|---|---|
| Slug/host resolution | `src/lib/slug.ts` | — (reads `window.location.hostname`) |
| Session for both roles | `src/context/SessionContext.tsx` | `branding/`, `public-profile/`, `auth/me/` |
| Main site | `src/features/main-site/` | `public/teachers/`, `public/teachers/{slug}/` |
| Workspace shell | `src/features/workspace-shell/` | unavailable (403) / not found (404) pages |
| Student auth | `src/features/student/` | `auth/register|login|logout|me|password-reset(/confirm)` |
| Student dashboards | `src/features/student/dashboard/` | `courses/`, `courses/{id}/enroll/`, `enrollments/me/`, payments claim |
| Course content | `src/features/course-content/` | `courses/`, `topics/`, `questions/…`, `exams/…`, `exams/…/questions/`, `exams/…/publish|archive` |
| Exam attempts (student) | `src/features/course-content/ExamPage.tsx`, `StudentExamsPage.tsx` | `exams/`, `exams/…/attempts/start/`, `attempts/…/`, `attempts/…/submit/` |
| Proctoring | `src/features/teacher/dashboard/ProctoringPage.tsx` | `attempts/…/proctoring/events/`, `proctoring/events/…/review/`, `attempts/…/browser-events/` |
| Teacher auth | `src/features/teacher/LoginPage.tsx`, `SetPasswordPage.tsx` | `staff/auth/login|set-password|password-reset` |
| Teacher dashboards | `src/features/teacher/dashboard/` | `workspaces/{slug}/` PATCH, `students/…/approve|reject`, `courses/`, `payments/…/confirm|reject|receipt` |

Rules baked into the UI (mirror the backend, never let users past forms it will reject):

- Receipt upload: JPEG/PNG/PDF, max 5 MB (client-checked, enforced again by the backend).
- Reject reasons and claim notes: max 1000 chars.
- Amounts are decimal strings from the API; `0.00` renders as "مجانًا".
- Login pages show pending (`pending_approval`) and rejected (with `rejection_reason`) states from the
  403 body instead of a generic error.
- The teacher login page is deliberately not linked from student areas.
- `?workspace=science` on `localhost` previews a workspace on the main origin (dev helper in
  `src/lib/slug.ts`; real routing is always the sub-domain).
- The content screens (`src/features/course-content/`) use real API data for courses, topics, the
  question bank and exams (create/edit/approve/reject/archive/publish, plus the ordered exam
  question list). Lessons and lesson assets are the only remaining preview: this backend round has
  no endpoints for them, so those sections say so on screen and never fake a request.
- The student exam page shows the real attempt lifecycle (consent, start, server timer, auto-submit,
  tab-hidden signal, submit). The API does not yet send questions or grade answers, so no questions
  are displayed and the result screen shows the attempt state without a score.
- Proctoring review lives at `/teacher/proctoring`; because there is no attempt-list endpoint yet,
  it is opened with an attempt id (`/teacher/proctoring?attempt=12`).
- Course-scoped sidebar links are contextual: the teacher's `محتوى الدورة` appears on a course
  content route, and the student's `الدروس` / `الاختبار` appear while any course route is open.
  They are derived from the URL (`useMatch`), never from component state.

## Editing the UI your own way

All visual primitives live in `src/components/ui.tsx` (Button, Input, Card, badges,
Alert, Spinner, pagination, `CourseCover`) and the three layouts in
`src/components/layout/`. Restyle by changing the semantic variables in
`src/index.css` (`:root` / `.dark`) — the Tailwind utilities follow automatically.
The API layer (`src/api/`, `src/lib/`) is independent of the visuals — you should not
need to touch it while restyling.
