import { t } from "../i18n";

// Long-term progress: filled in by the progression phase (charts, records, rank).
export default function ProgressPage() {
  return (
    <main className="flex-1 min-h-0 px-5 pb-5">
      <section className="h-full bg-panel rounded-xl px-5 py-4 flex items-center justify-center">
        <p className="max-w-sm text-center text-muted">{t("pages.progressEmpty")}</p>
      </section>
    </main>
  );
}
