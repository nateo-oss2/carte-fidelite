/**
 * Détermine si l'heure actuelle (fuseau France, pas celui du serveur — Railway tourne en UTC)
 * tombe dans le créneau "heures creuses" configuré par l'entreprise, pour doubler les points.
 */
export function isOffPeakNow(company: { offPeakBonusEnabled: boolean; offPeakStartHour: number; offPeakEndHour: number }): boolean {
  if (!company.offPeakBonusEnabled) return false;

  const parisHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", hour: "numeric", hour12: false }).format(new Date()),
  );

  const { offPeakStartHour: start, offPeakEndHour: end } = company;
  if (start === end) return false;

  // Gère aussi un créneau qui traverse minuit (ex: 22h-2h), même si la config actuelle
  // (14h-19h par défaut) n'en a pas besoin.
  if (start < end) {
    return parisHour >= start && parisHour < end;
  }
  return parisHour >= start || parisHour < end;
}
