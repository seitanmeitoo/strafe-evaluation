import { For, Show } from "solid-js";
import { t } from "../i18n";
import { CloseIcon } from "./Icons";

const btn =
  "h-8 px-3 rounded-md border border-line bg-card text-ink text-[13px] font-medium hover:border-muted transition-colors cursor-pointer select-none";
const iconBtn =
  "h-8 w-8 flex items-center justify-center rounded-md border border-line bg-card text-ink hover:border-muted transition-colors cursor-pointer select-none";

const say = (item) => t(`feedback.${item.key}`, item.params);

function Section(props) {
  return (
    <section className="py-3 border-t border-line first:border-t-0">
      <h3 className="text-[13px] font-semibold mb-1">{props.title}</h3>
      {props.children}
    </section>
  );
}

function Items(props) {
  return (
    <Show when={props.items?.length > 0} fallback={<p className="text-muted">{t("feedback.nothingYet")}</p>}>
      <ul className="space-y-1">
        <For each={props.items}>{(item) => <li>{say(item)}</li>}</For>
      </ul>
    </Show>
  );
}

/** Rule-based summary of one saved session (props.session), shown in a modal. */
export default function SessionSummaryModal(props) {
  const feedback = () => props.session?.feedback;

  const Figure = (p) => (
    <div className="flex flex-col">
      <span className="text-[12px] text-muted">{p.label}</span>
      <span className="text-[17px] font-bold leading-tight">{p.value}</span>
    </div>
  );

  return (
    <Show when={props.session}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div className="bg-surface text-ink rounded-xl border border-line shadow-lg w-full max-w-lg max-h-[calc(100vh-48px)] flex flex-col overflow-hidden text-[13px]">
          <div className="h-12 shrink-0 flex justify-between items-center px-5 border-b border-line">
            <h2 className="text-base font-bold">{t("feedback.title")}</h2>
            <button type="button" className={iconBtn} onClick={props.onClose} title={t("sessions.close")}>
              <CloseIcon />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-3">
            <Show when={feedback()} fallback={<p className="py-6 text-muted">{t("feedback.noFeedback")}</p>}>
              <p className="text-[15px] font-semibold">{say(feedback().headline)}</p>
              <p className="text-[12px] text-muted mb-3">
                {feedback().comparedTo ? t("feedback.comparedNote") : t("feedback.firstNote")}
              </p>

              <div className="grid grid-cols-4 gap-3 pb-3">
                <Figure label={t("table.perfect")} value={`${props.session.perfectRate}%`} />
                <Figure label={t("table.median")} value={`${props.session.medianDurationMs} ms`} />
                <Figure
                  label={t("table.consistency")}
                  value={props.session.analysis?.cv != null ? `${Math.round(props.session.analysis.cv * 100)}%` : "–"}
                />
                <Figure
                  label={t("metrics.accurateShotsTitle")}
                  value={props.session.totalShots > 0 ? `${props.session.accurateRate}%` : "–"}
                />
              </div>

              <Section title={t("feedback.strengthsTitle")}>
                <Items items={feedback().strengths} />
              </Section>
              <Section title={t("feedback.improvementsTitle")}>
                <Items items={feedback().improvements} />
              </Section>
              <Show when={feedback().fatigue}>
                <Section title={t("feedback.fatigueTitle")}>
                  <p>{say(feedback().fatigue)}</p>
                </Section>
              </Show>
              <Section title={t("feedback.recommendationTitle")}>
                <p className="font-semibold">{say(feedback().recommendation)}</p>
              </Section>
            </Show>
          </div>

          <div className="h-14 shrink-0 px-5 border-t border-line flex justify-end items-center">
            <button type="button" className={btn} onClick={props.onClose}>
              {t("sessions.close")}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
