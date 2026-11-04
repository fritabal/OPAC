import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, HelpCircle, AlertTriangle } from 'lucide-react';
import { Project } from '../types/project';
import { KeySkill } from '../types/skill';
import { Resource } from '../types/resource';
import { getWorkingDaysInMonth, roundToHalfDay, calculateResourceAvailability } from '../utils/workingDays';
import { formatPeriodLocale } from '../utils/dateUtils';
import { Tooltip } from './Tooltip';
import {
  SEGMENT_SELECTOR_CONTAINER_CLASS,
  getSegmentSelectorButtonClass,
} from '../constants/ui';

interface ConsolidatedCapacityHistoryCardProps {
  projects: Project[];
  skills: KeySkill[];
  resources: Resource[];
}

export const ConsolidatedCapacityHistoryCard: React.FC<ConsolidatedCapacityHistoryCardProps> = ({
  projects,
  skills,
  resources,
}) => {
  const { t, i18n } = useTranslation();
  const [rangeMonthsCount, setRangeMonthsCount] = useState<6 | 12>(6);
  const [filterBottlenecksOnly, setFilterBottlenecksOnly] = useState(false);

  // Génère la liste chronologique des N derniers mois jusqu'au mois en cours
  const months = useMemo(() => {
    const list: { key: string; label: string; year: number; month: number; monthName: string }[] = [];
    const now = new Date();

    for (let i = rangeMonthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const label = formatPeriodLocale(key, i18n.language, { format: 'short' });
      const monthName = d.toLocaleDateString(i18n.language, { month: 'short' });
      list.push({ key, label, year, month, monthName });
    }

    return list;
  }, [rangeMonthsCount, i18n.language]);

  // Récupère la valeur de demande d'un projet pour une compétence et un mois donné
  const getProjectDemand = (p: Project, skillId: string, monthKey: string): number => {
    if (p.capacityHistory && p.capacityHistory[monthKey] !== undefined) {
      const val = p.capacityHistory[monthKey][skillId];
      return typeof val === 'number' && !isNaN(val) && val >= 0 ? val : 0;
    }

    if (p.capacityUpdatedMonth === monthKey && p.isStaffed !== false) {
      const val = p.capacityDaysPerSkill?.[skillId];
      return typeof val === 'number' && !isNaN(val) && val >= 0 ? val : 0;
    }

    return 0;
  };

  // Détection des compétences en tension (goulets d'étranglement sur le dernier mois chronologique)
  const bottleneckSkillsLastMonth = useMemo(() => {
    const latestMonth = months[months.length - 1];
    if (!latestMonth) return new Set<string>();

    const workingDays = getWorkingDaysInMonth(latestMonth.year, latestMonth.month);
    const set = new Set<string>();

    skills.forEach((skill) => {
      if (!skill.alertOnDemandOverrun) return;

      // Capacité totale C disponible sur ce dernier mois pour cette compétence (arrondie à 0,5 près)
      let C = 0;
      (resources || []).forEach((res) => {
        if (res.skillId === skill.id) {
          const avail = calculateResourceAvailability(
            workingDays,
            res.fte,
            res.unavailability && typeof res.unavailability[latestMonth.key] === 'number'
              ? res.unavailability[latestMonth.key]
              : 0
          );
          C += avail;
        }
      });
      C = roundToHalfDay(C);

      // Somme des demandes de tous les projets pour cette compétence sur ce dernier mois
      let totalDemanded = 0;
      projects.forEach((p) => {
        const dem = getProjectDemand(p, skill.id, latestMonth.key);
        if (dem > 0) totalDemanded += dem;
      });
      totalDemanded = Math.round(totalDemanded * 10) / 10;

      // Si la demande excède la capacité C, la compétence est en tension
      if (totalDemanded > C) {
        set.add(skill.id);
      }
    });

    return set;
  }, [months, skills, resources, projects]);

  // Filtrage : toutes les compétences ou seulement les compétences en tension sur le dernier mois
  const filteredSkills = useMemo(() => {
    if (filterBottlenecksOnly) {
      return skills.filter((s) => bottleneckSkillsLastMonth.has(s.id));
    }
    return skills;
  }, [skills, filterBottlenecksOnly, bottleneckSkillsLastMonth]);

  const latestMonthLabel = months[months.length - 1]?.label || '';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 space-y-5">
      {/* En-tête de la carte avec titre, bouton de filtre en tension et sélecteur de période */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0 shadow-2xs">
            <LineChart className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {t(
                'reports.consolidated_capacity.title',
                'Historique capacitaire consolidé par compétence clé'
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t(
                'reports.consolidated_capacity.subtitle',
                'Consolidation sur tous les projets : comparaison entre demandes capacitaires et jours honorés'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {/* Bouton pour filtrer sur "Compétences en tension" */}
          <button
            type="button"
            onClick={() => setFilterBottlenecksOnly((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              filterBottlenecksOnly
                ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-200/60 font-bold shadow-2xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
            }`}
            title={
              filterBottlenecksOnly
                ? t(
                    'reports.consolidated_capacity.filter_tension_active_tooltip',
                    'Filtre actif : compétences qui étaient goulets d’étranglement sur le dernier mois (cliquer pour afficher toutes les compétences)'
                  )
                : t(
                    'reports.consolidated_capacity.filter_tension_inactive_tooltip',
                    'Filtrer sur les compétences qui étaient goulets d’étranglement sur le dernier mois'
                  )
            }
          >
            <AlertTriangle
              className={`w-3.5 h-3.5 ${
                filterBottlenecksOnly ? 'text-rose-600' : 'text-slate-400'
              }`}
            />
            <span>
              {t('reports.consolidated_capacity.filter_tension_button', 'Compétences en tension')}
            </span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                filterBottlenecksOnly
                  ? 'bg-rose-200/80 text-rose-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {bottleneckSkillsLastMonth.size}
            </span>
          </button>

          {/* Sélecteur de période (6 mois ou 12 mois) */}
          <div className={SEGMENT_SELECTOR_CONTAINER_CLASS}>
            <button
              type="button"
              onClick={() => setRangeMonthsCount(6)}
              className={getSegmentSelectorButtonClass(rangeMonthsCount === 6)}
            >
              6 {t('capacity.history.months_short', 'mois')}
            </button>
            <button
              type="button"
              onClick={() => setRangeMonthsCount(12)}
              className={getSegmentSelectorButtonClass(rangeMonthsCount === 12)}
            >
              12 {t('capacity.history.months_short', 'mois')}
            </button>
          </div>
        </div>
      </div>

      {/* Liste des compétences clés sous forme de lignes avec histogrammes SVG */}
      <div className="space-y-4">
        {filteredSkills.length === 0 ? (
          <div className="text-center py-12 text-slate-400 italic">
            {filterBottlenecksOnly
              ? t(
                  'reports.consolidated_capacity.no_bottlenecks_last_month',
                  'Aucune compétence clé en tension sur le dernier mois ({{month}}).',
                  { month: latestMonthLabel }
                )
              : t('reports.consolidated_capacity.no_skills', 'Aucune compétence clé configurée.')}
          </div>
        ) : (
          filteredSkills.map((skill) => {
            // Données consolidées sur tous les projets pour chaque mois
            const skillData = months.map((m) => {
              // 1. Somme des demandes de tous les projets pour cette compétence sur ce mois
              let totalDemanded = 0;
              projects.forEach((p) => {
                const dem = getProjectDemand(p, skill.id, m.key);
                if (dem > 0) totalDemanded += dem;
              });
              totalDemanded = Math.round(totalDemanded * 10) / 10;

              if (totalDemanded <= 0) {
                return {
                  key: m.key,
                  label: m.label,
                  year: m.year,
                  monthName: m.monthName,
                  demandedDays: 0,
                  staffedDays: 0,
                  capacity: 0,
                  allHonored: true,
                };
              }

              // 2. Capacité totale C disponible sur ce mois pour cette compétence (arrondie à 0,5 près)
              const workingDays = getWorkingDaysInMonth(m.year, m.month);
              let C = 0;
              (resources || []).forEach((res) => {
                if (res.skillId === skill.id) {
                  const avail = calculateResourceAvailability(
                    workingDays,
                    res.fte,
                    res.unavailability && typeof res.unavailability[m.key] === 'number'
                      ? res.unavailability[m.key]
                      : 0
                  );
                  C += avail;
                }
              });
              C = roundToHalfDay(C);

              // Si l'attribut d'alerte de dépassement n'est pas actif pour cette compétence
              if (!skill.alertOnDemandOverrun) {
                return {
                  key: m.key,
                  label: m.label,
                  year: m.year,
                  monthName: m.monthName,
                  demandedDays: totalDemanded,
                  staffedDays: totalDemanded,
                  capacity: C,
                  allHonored: true,
                };
              }

              // Comparaison consolidated : les jours honorés correspondent au minimum entre demande totale et capacité C
              const allHonored = totalDemanded <= C;
              const staffedDays = Math.max(0, Math.min(totalDemanded, C));

              return {
                key: m.key,
                label: m.label,
                year: m.year,
                monthName: m.monthName,
                demandedDays: totalDemanded,
                staffedDays: Math.round(staffedDays * 10) / 10,
                capacity: C,
                allHonored,
              };
            });

            // Calcul de l'échelle max pour l'axe des ordonnées
            const rawMax = Math.max(...skillData.map((d) => d.demandedDays), 0);
            const maxVal = rawMax <= 0 ? 10 : Math.ceil(rawMax * 1.25);
            const totalDemanded = skillData.reduce((acc, curr) => acc + curr.demandedDays, 0);
            const totalStaffed = skillData.reduce(
              (acc, curr) => acc + (curr.allHonored ? curr.demandedDays : curr.staffedDays),
              0
            );

            // Dimensions SVG
            const svgWidth = 800;
            const svgHeight = 135;
            const marginLeft = 45;
            const marginRight = 20;
            const marginTop = 24;
            const marginBottom = 34;
            const plotWidth = svgWidth - marginLeft - marginRight;
            const plotHeight = svgHeight - marginTop - marginBottom;
            const nBars = skillData.length;
            const slotWidth = plotWidth / nBars;
            const barWidth = Math.min(30, Math.max(16, slotWidth * 0.40));
            const baseY = marginTop + plotHeight;

            return (
              <div
                key={skill.id}
                className="p-4 bg-slate-50/60 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Colonne gauche : Description de la compétence et totaux */}
                  <div className="w-full lg:w-56 shrink-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {skill.name}
                      </span>
                      {skill.description?.trim() && (
                        <Tooltip
                          title={skill.name}
                          content={skill.description}
                          placement="top"
                        >
                          <span className="inline-flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-help transition-colors shrink-0">
                            <HelpCircle className="w-3.5 h-3.5" />
                          </span>
                        </Tooltip>
                      )}
                    </div>

                    <div className="mt-2 text-xs text-slate-600 font-medium space-y-0.5">
                      <div>
                        <span>
                          {t('reports.consolidated_capacity.total_period_demanded', 'Total demandé')}{' '}
                          :{' '}
                        </span>
                        <span className="font-bold text-indigo-700 font-mono">
                          {Math.round(totalDemanded * 10) / 10} {t('capacity.units.day_short', 'j')}
                        </span>
                      </div>
                      {totalStaffed < totalDemanded && (
                        <div className="text-[11px] text-red-600 font-semibold">
                          <span>
                            {t('reports.consolidated_capacity.total_period_staffed', 'Total honoré')}{' '}
                            :{' '}
                          </span>
                          <span className="font-bold font-mono">
                            {Math.round(totalStaffed * 10) / 10} {t('capacity.units.day_short', 'j')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Colonne droite : Histogramme SVG avec 2 axes orthogonaux */}
                  <div className="flex-1 w-full overflow-x-auto [scrollbar-width:none]">
                    <svg
                      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                      className="w-full h-auto min-w-[550px]"
                      style={{ display: 'block' }}
                    >
                      {/* Ligne horizontale de fond / grille médiane */}
                      <line
                        x1={marginLeft}
                        y1={marginTop + plotHeight / 2}
                        x2={svgWidth - marginRight}
                        y2={marginTop + plotHeight / 2}
                        stroke="#e2e8f0"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />

                      {/* Axe des ordonnées Y (axe vertical orthogonal) */}
                      <line
                        x1={marginLeft}
                        y1={marginTop - 5}
                        x2={marginLeft}
                        y2={baseY}
                        stroke="#64748b"
                        strokeWidth="1.5"
                      />
                      {/* Graduations et libellés axe Y */}
                      <text
                        x={marginLeft - 6}
                        y={marginTop + 3}
                        textAnchor="end"
                        className="text-[9px] font-semibold fill-slate-500 font-mono"
                      >
                        {maxVal}j
                      </text>
                      <text
                        x={marginLeft - 6}
                        y={marginTop + plotHeight / 2 + 3}
                        textAnchor="end"
                        className="text-[9px] font-semibold fill-slate-400 font-mono"
                      >
                        {Math.round((maxVal / 2) * 10) / 10}j
                      </text>
                      <text
                        x={marginLeft - 6}
                        y={baseY}
                        textAnchor="end"
                        className="text-[9px] font-semibold fill-slate-500 font-mono"
                      >
                        0j
                      </text>

                      {/* Axe des abscisses X (axe horizontal orthogonal) */}
                      <line
                        x1={marginLeft}
                        y1={baseY}
                        x2={svgWidth - marginRight + 5}
                        y2={baseY}
                        stroke="#64748b"
                        strokeWidth="1.5"
                      />

                      {/* Barres d'histogramme pour chaque mois */}
                      {skillData.map((item, idx) => {
                        const xCenter = marginLeft + (idx + 0.5) * slotWidth;
                        const isZero = item.demandedDays <= 0;

                        if (isZero) {
                          return (
                            <g key={item.key} className="group">
                              <title>{`${item.label}: 0 j`}</title>
                              <rect
                                x={xCenter - barWidth / 2}
                                y={baseY - 2}
                                width={barWidth}
                                height={2}
                                rx={1}
                                className="fill-slate-200"
                              />
                              <text
                                x={xCenter}
                                y={baseY - 6}
                                textAnchor="middle"
                                className="text-[11px] font-bold fill-slate-400 font-mono select-none"
                              >
                                0
                              </text>
                              <text
                                x={xCenter}
                                y={baseY + 13}
                                textAnchor="middle"
                                className="text-[10px] font-bold fill-slate-700 select-none capitalize"
                              >
                                {item.monthName}
                              </text>
                              <text
                                x={xCenter}
                                y={baseY + 24}
                                textAnchor="middle"
                                className="text-[9px] font-medium fill-slate-400 select-none font-mono"
                              >
                                {item.year}
                              </text>
                            </g>
                          );
                        }

                        // Cas 1 : Tous les jours demandés ont pu être honorés
                        // -> Barre bleue avec texte en bleu au-dessus
                        if (item.allHonored) {
                          const barH = maxVal > 0 ? (item.demandedDays / maxVal) * plotHeight : 0;
                          const barX = xCenter - barWidth / 2;
                          const barY = baseY - barH;

                          return (
                            <g key={item.key} className="group">
                              <title>{`${item.label} : ${item.demandedDays} j demandés et honorés (capacité : ${item.capacity} j)`}</title>
                              <rect
                                x={barX}
                                y={barY}
                                width={barWidth}
                                height={barH}
                                rx={3}
                                fill="#4f46e5"
                                className="transition-colors hover:opacity-90 cursor-default"
                              />
                              <text
                                x={xCenter}
                                y={Math.max(14, barY - 4)}
                                textAnchor="middle"
                                className="text-[11px] font-bold fill-indigo-700 font-mono select-none"
                              >
                                {item.demandedDays}
                              </text>
                              <text
                                x={xCenter}
                                y={baseY + 13}
                                textAnchor="middle"
                                className="text-[10px] font-bold fill-slate-700 select-none capitalize"
                              >
                                {item.monthName}
                              </text>
                              <text
                                x={xCenter}
                                y={baseY + 24}
                                textAnchor="middle"
                                className="text-[9px] font-medium fill-slate-400 select-none font-mono"
                              >
                                {item.year}
                              </text>
                            </g>
                          );
                        }

                        // Cas 2 : Tous les jours demandés n'ont PAS pu être honorés (déficit capacitaire consolidé)
                        // -> Barre demandée en bleu désaturé avec nombre de jours en bleu soutenu
                        // -> Deuxième barre superposée au premier plan, légèrement décalée sur la droite, rouge
                        //    (si 0 jour : hauteur minimum de 3px)
                        // -> Nombre de jours réellement staffés au dessus de la barre rouge, aligné à droite
                        const demandedH =
                          maxVal > 0 ? (item.demandedDays / maxVal) * plotHeight : 0;
                        const staffedH =
                          item.staffedDays > 0 ? (item.staffedDays / maxVal) * plotHeight : 3;
                        const shiftX = rangeMonthsCount === 6 ? 22 : 15;
                        const blueW = barWidth;
                        const redW = barWidth;
                        const blueX = xCenter - (barWidth + shiftX) / 2;
                        const redX = blueX + shiftX;
                        const blueY = baseY - demandedH;
                        const redY = baseY - staffedH;
                        const deficit =
                          Math.round((item.demandedDays - item.staffedDays) * 10) / 10;

                        return (
                          <g key={item.key} className="group">
                            <title>{`${item.label} : ${item.demandedDays} j demandés • ${item.staffedDays} j accordés (capacité max : ${item.capacity} j, déficit : ${deficit} j)`}</title>

                            {/* Barre des jours demandés (en arrière-plan) : bleu désaturé */}
                            <rect
                              x={blueX}
                              y={blueY}
                              width={blueW}
                              height={demandedH}
                              rx={3}
                              fill="#93b4d4"
                              className="transition-colors hover:opacity-90 cursor-default"
                            />

                            {/* Barre des jours réellement accordés (au premier plan, décalée sur la droite) : rouge */}
                            <rect
                              x={redX}
                              y={redY}
                              width={redW}
                              height={staffedH}
                              rx={item.staffedDays > 0 ? 3 : 1}
                              fill="#ef4444"
                              className="transition-colors hover:opacity-95 cursor-default"
                            />

                            {/* Nombre de jours demandés au-dessus en bleu soutenu */}
                            <text
                              x={redX - 2}
                              y={Math.max(14, blueY - 4)}
                              textAnchor="end"
                              className="text-[11px] font-bold fill-blue-700 font-mono select-none"
                            >
                              {item.demandedDays}
                            </text>

                            {/* Nombre de jours réellement staffés au-dessus de la barre rouge, aligné à droite */}
                            <text
                              x={redX + redW}
                              y={item.staffedDays === 0 ? baseY - 6 : Math.max(14, redY - 4)}
                              textAnchor="end"
                              className="text-[11px] font-bold fill-red-600 font-mono select-none"
                            >
                              {item.staffedDays}
                            </text>

                            {/* Libellé du mois et année sous l'axe X (abscisse) */}
                            <text
                              x={xCenter}
                              y={baseY + 13}
                              textAnchor="middle"
                              className="text-[10px] font-bold fill-slate-700 select-none capitalize"
                            >
                              {item.monthName}
                            </text>
                            <text
                              x={xCenter}
                              y={baseY + 24}
                              textAnchor="middle"
                              className="text-[9px] font-medium fill-slate-400 select-none font-mono"
                            >
                              {item.year}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Légende explicative */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap text-xs text-slate-500">
        <div className="flex items-center gap-4 flex-wrap text-[11px] font-medium text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-[2px] bg-indigo-600 inline-block" />
            <span>{t('reports.consolidated_capacity.legend_honored', 'Demande honorée')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#93b4d4] inline-block" />
            <span>{t('reports.consolidated_capacity.legend_initial', 'Demande initiale')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-[2px] bg-red-500 inline-block" />
            <span>{t('reports.consolidated_capacity.legend_staffed', 'Jours accordés (déficit)')}</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 italic">
          {t(
            'capacity.history.standby_hint',
            'Un projet non staffé ou sans mise à jour enregistre automatiquement 0 jour.'
          )}
        </div>
      </div>
    </div>
  );
};
