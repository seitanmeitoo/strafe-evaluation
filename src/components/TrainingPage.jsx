import { t } from "../i18n";

// Training drills: filled in by the drill phases (configuration, shortcuts, results).
export default function TrainingPage() {
  return (
    <main className="flex-1 min-h-0 px-5 pb-5">
      <section className="h-full bg-panel rounded-xl px-5 py-4 flex items-center justify-center">
        <p className="max-w-sm text-center text-muted">{t("pages.trainingEmpty")}</p>
      </section>
    </main>
  );
}
