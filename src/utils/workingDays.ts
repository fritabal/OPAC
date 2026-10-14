/**
 * Calcul du nombre de jours ouvrés (du lundi au vendredi, hors jours fériés légaux français)
 * pour un mois et une année donnés.
 */

export function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = Mars, 4 = Avril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function getFrenchPublicHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  const addHoliday = (m: number, d: number) => {
    holidays.add(`${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  };

  // Jours fériés fixes en France
  addHoliday(1, 1);   // Jour de l'An
  addHoliday(5, 1);   // Fête du Travail
  addHoliday(5, 8);   // Victoire 1945
  addHoliday(7, 14);  // Fête Nationale
  addHoliday(8, 15);  // Assomption
  addHoliday(11, 1);  // Toussaint
  addHoliday(11, 11); // Armistice 1918
  addHoliday(12, 25); // Noël

  // Jours fériés mobiles liés à Pâques
  const easter = getEasterSunday(year);

  // Lundi de Pâques (+1 jour)
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  addHoliday(easterMonday.getMonth() + 1, easterMonday.getDate());

  // Jeudi de l'Ascension (+39 jours)
  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 39);
  addHoliday(ascension.getMonth() + 1, ascension.getDate());

  // Lundi de Pentecôte (+50 jours)
  const whitMonday = new Date(easter);
  whitMonday.setDate(easter.getDate() + 50);
  addHoliday(whitMonday.getMonth() + 1, whitMonday.getDate());

  return holidays;
}

/**
 * Retourne le nombre exact de jours ouvrés pour un mois donné (hors samedis, dimanches et fériés légaux)
 * @param year Année (ex: 2026)
 * @param month Mois (1 = Janvier, ..., 12 = Décembre)
 */
export function getWorkingDaysInMonth(year: number, month: number): number {
  const holidays = getFrenchPublicHolidays(year);
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay(); // 0 = Dimanche, 6 = Samedi
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (!holidays.has(dateKey)) {
        workingDays++;
      }
    }
  }

  return workingDays;
}
