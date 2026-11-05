import { mainSiteUrl } from "../lib/slug";
import { Button } from "./ui";

/** Outside route layouts so login, loading and unavailable pages also have an exit. */
export default function HomeButton() {
  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      className="fixed bottom-4 start-4 z-30 rounded-pill shadow-elevated sm:bottom-6 sm:start-6"
      onClick={() => window.location.assign(mainSiteUrl())}
      aria-label="العودة إلى الصفحة الرئيسية لوجهة"
      title="العودة إلى الصفحة الرئيسية لوجهة"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" />
      </svg>
      الرئيسية
    </Button>
  );
}
