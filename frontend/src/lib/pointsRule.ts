/**
 * `pointsPerCurrencyUnit` est un nombre de POINTS PAR EURO (ex: 0.5 = 1 point tous les 2€).
 * Cette fonction le traduit dans la phrase la plus lisible pour un client : soit "N€ dépensé
 * = 1 point" quand le taux est inférieur à 1, soit "1€ dépensé = N points" sinon.
 */
export function describePointsRule(pointsPerCurrencyUnit: string): string {
  const rate = Number(pointsPerCurrencyUnit);
  if (!Number.isFinite(rate) || rate <= 0) {
    return "";
  }
  if (rate < 1) {
    const euros = Number((1 / rate).toFixed(2));
    return `${euros}€ dépensé = 1 point`;
  }
  const points = Number(rate.toFixed(2));
  return `1€ dépensé = ${points} point${points > 1 ? "s" : ""}`;
}
