import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, LineChart, Info, HelpCircle } from 'lucide-react';
import { Project } from '../types/project';
import { KeySkill } from '../types/skill';
import { Resource } from '../types/resource';
import { getWorkingDaysInMonth, roundToHalfDay, calculateResourceAvailability } from '../utils/workingDays';
import { formatPeriodLocale } from '../utils/dateUtils';
import { Tooltip } from './Tooltip';
import {
  SEGMENT_SELECTOR_CONTAINER_CLASS,
  getSegmentSelectorButtonClass,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_TITLE_CLASS,
  PROJECT_TITLE_CLASS,
} from '../constants/ui';

interface ProjectCapacityHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  skills: KeySkill[];
  orderedProjects?: Project[];
  resources?: Resource[];
}

export const ProjectCapacityHistoryModal: React.FC<ProjectCapacityHistoryModalProps> = ({
  isOpen,
  onClose,
  project,
  skills,
  orderedProjects,
  resources,
}) => {
  const { t, i18n } = useTranslation();
  const [rangeMonthsCount, setRangeMonthsCount] = useState<6 | 12>(6);

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

  if (!isOpen || !project) return null;

  // Récupère la valeur de demande pour un projet, une compétence et un mois donné
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="capacity-history-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* En-tête de la modale */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0 shadow-2xs">
              <LineChart className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`${PROJECT_TITLE_CLASS} font-mono`}>
                  #{project.projectNumber}
                </span>
                <span className="text-slate-300 font-normal select-none mx-0.5">—</span>
                <h2 id="capacity-history-title" className={`${PROJECT_TITLE_CLASS} truncate max-w-sm sm:max-w-md`}>
                  {project.name}
                </h2>
                {project.isConfidential && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-red-700 border border-rose-300">
                    {t('common.confidential', 'Confidentiel')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {t('capacity.history.subtitle', 'Historique mensuel des demandes capacitaires par compétence clé')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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

            {/* Bouton de fermeture */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              aria-label={t('common.close', 'Fermer')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corps de la modale avec liste des compétences clés en lignes et histogrammes */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 [scrollbar-width:thin]">
          {skills.length === 0 ? (
            <div className="text-center py-12 text-slate-400 italic">
              {t('capacity.no_skills_declared', 'Aucune compétence clé configurée.')}
            </div>
          ) : (
            skills.map((skill) => {
              // Données pour cette compétence pour chaque mois de la période
              const skillData = months.map((m) => {
                const demandedDays = getProjectDemand(project, skill.id, m.key);

                if (demandedDays <= 0) {
                  return {
                    key: m.key,
                    label: m.label,
                    year: m.year,
                    monthName: m.monthName,
                    demandedDays: 0,
                    staffedDays: 0,
                    allHonored: true,
                  };
                }

                // Si l'attribut d'alerte de dépassement n'est pas actif pour cette compétence,
                // tous les jours demandés sont réputés honorés
                if (!skill.alertOnDemandOverrun) {
                  return {
                    key: m.key,
                    label: m.label,
                    year: m.year,
                    monthName: m.monthName,
                    demandedDays,
                    staffedDays: demandedDays,
                    allHonored: true,
                  };
                }

                // Capacité totale C disponible sur ce mois pour cette compétence (arrondie à 0,5 près)
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

                // Parcours des projets selon leur ordre strict de priorité
                const projList = orderedProjects && orderedProjects.length > 0 ? orderedProjects : [project];
                let cumulativeUsed = 0;
                let staffedDays = demandedDays;
                let allHonored = true;

                for (const p of projList) {
                  const pDemand = getProjectDemand(p, skill.id, m.key);
                  if (pDemand <= 0) continue;

                  const availableBefore = Math.max(0, Math.round((C - cumulativeUsed) * 10) / 10);

                  if (p.id === project.id) {
                    staffedDays = Math.min(demandedDays, availableBefore);
                    allHonored = staffedDays >= demandedDays;
                    break;
                  }

                  cumulativeUsed = Math.round((cumulativeUsed + pDemand) * 10) / 10;
                }

                return {
                  key: m.key,
                  label: m.label,
                  year: m.year,
                  monthName: m.monthName,
                  demandedDays,
                  staffedDays: Math.round(staffedDays * 10) / 10,
                  allHonored,
                };
              });

              // Calcul de l'échelle max pour l'axe des ordonnées
              const rawMax = Math.max(...skillData.map((d) => d.demandedDays), 0);
              const maxVal = rawMax <= 0 ? 5 : Math.ceil(rawMax * 1.25);
              const totalDemanded = skillData.reduce((acc, curr) => acc + curr.demandedDays, 0);

              // Dimensions SVG
              const svgWidth = 620;
              const svgHeight = 130;
              const marginLeft = 40;
              const marginRight = 15;
              const marginTop = 24;
              const marginBottom = 34;
              const plotWidth = svgWidth - marginLeft - marginRight;
              const plotHeight = svgHeight - marginTop - marginBottom;
              const nBars = skillData.length;
              const slotWidth = plotWidth / nBars;
              const barWidth = Math.min(26, Math.max(16, slotWidth * 0.40));
              const baseY = marginTop + plotHeight;

              return (
                <div
                  key={skill.id}
                  className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Colonne gauche : Description de la compétence */}
                    <div className="w-full lg:w-48 shrink-0">
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
                      <div className="mt-2 text-xs text-slate-600 font-medium">
                        <span>{t('capacity.history.total_period', 'Total période')} : </span>
                        <span className="font-bold text-indigo-700">
                          {Math.round(totalDemanded * 10) / 10} {t('capacity.units.day_short', 'j')}
                        </span>
                      </div>
                    </div>

                    {/* Colonne droite : Histogramme SVG avec 2 axes orthogonaux */}
                    <div className="flex-1 w-full overflow-x-auto [scrollbar-width:none]">
                      <svg
                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                        className="w-full h-auto min-w-[500px]"
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
                          className="text-[9px] font-semibold fill-slate-500"
                        >
                          {maxVal}j
                        </text>
                        <text
                          x={marginLeft - 6}
                          y={marginTop + plotHeight / 2 + 3}
                          textAnchor="end"
                          className="text-[9px] font-semibold fill-slate-400"
                        >
                          {Math.round((maxVal / 2) * 10) / 10}j
                        </text>
                        <text
                          x={marginLeft - 6}
                          y={baseY}
                          textAnchor="end"
                          className="text-[9px] font-semibold fill-slate-500"
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
                                  className="text-[11px] font-bold fill-slate-400 select-none"
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
                                <title>{`${item.label}: ${item.demandedDays} j demandés et accordés`}</title>
                                <rect
                                  x={barX}
                                  y={barY}
                                  width={barWidth}
                                  height={barH}
                                  rx={3}
                                  fill="#4f46e5"
                                  className="transition-colors hover:opacity-90"
                                />
                                <text
                                  x={xCenter}
                                  y={Math.max(14, barY - 4)}
                                  textAnchor="middle"
                                  className="text-[11px] font-bold fill-indigo-700 select-none"
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

                          // Cas 2 : Tous les jours demandés n'ont PAS pu être honorés
                          // -> Barre demandée en bleu désaturé avec nombre de jours en bleu soutenu
                          // -> Deuxième barre superposée au premier plan, légèrement décalée sur la droite, rouge
                          //    (si 0 jour : hauteur minimum de 3px)
                          // -> Nombre de jours réellement staffés au dessus de la barre rouge, aligné à droite
                          const demandedH = maxVal > 0 ? (item.demandedDays / maxVal) * plotHeight : 0;
                          const staffedH = item.staffedDays > 0 ? (item.staffedDays / maxVal) * plotHeight : 3;
                          const shiftX = rangeMonthsCount === 6 ? 18 : 13;
                          const blueW = barWidth;
                          const redW = barWidth;
                          const blueX = xCenter - (barWidth + shiftX) / 2;
                          const redX = blueX + shiftX;
                          const blueY = baseY - demandedH;
                          const redY = baseY - staffedH;

                          return (
                            <g key={item.key} className="group">
                              <title>{`${item.label}: ${item.demandedDays} j demandés • ${item.staffedDays} j accordés (déficit : ${Math.round((item.demandedDays - item.staffedDays) * 10) / 10} j)`}</title>

                              {/* Barre des jours demandés (en arrière-plan) : bleu désaturé */}
                              <rect
                                x={blueX}
                                y={blueY}
                                width={blueW}
                                height={demandedH}
                                rx={3}
                                fill="#93b4d4"
                                className="transition-colors hover:opacity-90"
                              />

                              {/* Barre des jours réellement accordés (au premier plan, décalée sur la droite) : rouge */}
                              <rect
                                x={redX}
                                y={redY}
                                width={redW}
                                height={staffedH}
                                rx={item.staffedDays > 0 ? 3 : 1}
                                fill="#ef4444"
                                className="transition-colors hover:opacity-95"
                              />

                              {/* Nombre de jours demandés au-dessus en bleu soutenu */}
                              <text
                                x={redX - 2}
                                y={Math.max(14, blueY - 4)}
                                textAnchor="end"
                                className="text-[11px] font-bold fill-blue-700 select-none"
                              >
                                {item.demandedDays}
                              </text>

                              {/* Nombre de jours réellement staffés au-dessus de la barre rouge, aligné à droite */}
                              <text
                                x={redX + redW}
                                y={item.staffedDays === 0 ? baseY - 6 : Math.max(14, redY - 4)}
                                textAnchor="end"
                                className="text-[11px] font-bold fill-red-600 select-none"
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

        {/* Pied de la modale */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Info className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                {t(
                  'capacity.history.standby_hint',
                  'Un projet non staffé ou sans mise à jour enregistre automatiquement 0 jour.'
                )}
              </span>
            </div>
            {/* Légende visuelle explicative */}
            <div className="flex items-center gap-3 text-[11px] font-medium text-slate-600">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-indigo-600 inline-block" />
                <span>Demande honorée</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-[#93b4d4] inline-block" />
                <span>Demande initiale</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-red-500 inline-block" />
                <span>Jours accordés</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={MODAL_CLOSE_BUTTON_CLASS}
            >
              {t('common.close', 'Fermer')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
