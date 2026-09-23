export default function Cs2MetricsCard(props) {
  const metrics = () =>
    props.metrics || {
      totalShots: 0,
      accurateShots: 0,
      accurateRate: 0,
      avgShotDelay: 0,
      avgResidualSpeed: 0,
    };

  const hasShots = () => metrics().totalShots > 0;

  return (
    <div className="grid grid-cols-3 gap-2 my-2 p-2 bg-bright/60 rounded-lg border border-dark/10 shadow-sm text-center">
      <div className="flex flex-col items-center justify-center p-1">
        <span className="text-xs uppercase tracking-wider text-dark/70 font-semibold">
          Tirs Précis CS2
        </span>
        <span
          className={`text-xl font-extrabold ${
            hasShots()
              ? metrics().accurateRate >= 75
                ? "text-primary"
                : metrics().accurateRate >= 50
                ? "text-amber-600"
                : "text-rose-600"
              : "text-dark/40"
          }`}
        >
          {hasShots() ? `${metrics().accurateRate}%` : "--%"}
        </span>
        <span className="text-[10px] text-dark/60">
          {hasShots()
            ? `${metrics().accurateShots}/${metrics().totalShots} tirs`
            : "Aucun tir"}
        </span>
      </div>

      <div className="flex flex-col items-center justify-center p-1 border-x border-dark/10">
        <span className="text-xs uppercase tracking-wider text-dark/70 font-semibold">
          Délai Tir
        </span>
        <span className="text-xl font-extrabold text-dark">
          {hasShots() ? `${metrics().avgShotDelay} ms` : "-- ms"}
        </span>
        <span className="text-[10px] text-dark/60">Arrêt ➔ mouse1</span>
      </div>

      <div className="flex flex-col items-center justify-center p-1">
        <span className="text-xs uppercase tracking-wider text-dark/70 font-semibold">
          Vitesse Résiduelle
        </span>
        <span
          className={`text-xl font-extrabold ${
            hasShots()
              ? metrics().avgResidualSpeed <= 85
                ? "text-primary"
                : "text-rose-600"
              : "text-dark/40"
          }`}
        >
          {hasShots() ? `${metrics().avgResidualSpeed} u/s` : "-- u/s"}
        </span>
        <span className="text-[10px] text-dark/60">&lt; 85 u/s = Précis</span>
      </div>
    </div>
  );
}
