import React, { useMemo } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  Briefcase,
  Gauge,
  TrendingUp,
  Coins,
  Brain,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  PieChart,
} from 'lucide-react';
import { Project } from '../types/project';
import { KeySkill } from '../types/skill';
import { ProjectState } from '../types/lifecycle';
import { BudgetLine } from '../types/budget';
import { Criterion } from '../types/criteria';
import { AppUser } from '../types/user';
import { BonusConfig } from '../types/bonus';
import { calculateProjectRoi, formatRoi } from '../utils/roiCalculator';
import { PRIMARY_ACTION_HEADER_BUTTON_CLASS } from '../constants/ui';

interface ProjectsReportsViewProps {
  projects: Project[];
  skills: KeySkill[];
  projectStates: ProjectState[];
  budgetLines: BudgetLine[];
  criteria: Criterion[];
  users: AppUser[];
  bonusConfig?: BonusConfig;
}

export const ProjectsReportsView: React.FC<ProjectsReportsViewProps> = ({
  projects,
  skills,
  projectStates,
  budgetLines,
  criteria,
  bonusConfig,
}) => {
  // Prochain mois
  const { nextMonthKey, nextMonthLabel } = useMemo(() => {
    const now = new Date();
    const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const year = nextDate.getFullYear();
    const month = nextDate.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return {
      nextMonthKey: key,
      nextMonthLabel: `${monthNames[nextDate.getMonth()]} ${year}`,
    };
  }, []);

  // Projets avec calcul de ROI et priorités
  const analyzedProjects = useMemo(() => {
    return projects.map((p) => {
      const state = projectStates.find((st) => st.id === p.stateId);
      const isStaffed = Boolean(state?.needsStaffing) ? p.isStaffed !== false : p.isStaffed === true;
      const roi = calculateProjectRoi(p.criteriaValues, criteria, true, p.bonus, bonusConfig?.isBonusActive ?? true);
      const isPrioritized = isStaffed && roi !== null;
      return { project: p, state, roi, isPrioritized };
    });
  }, [projects, projectStates, criteria, bonusConfig]);

  // Statistiques globales
  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const totalBudget = projects.reduce((sum, p) => sum + (p.estimatedBudget || 0), 0);
    const prioritizedCount = analyzedProjects.filter((i) => i.isPrioritized).length;
    const bonusedCount = projects.filter((p) => typeof p.bonus === 'number' && p.bonus > 0).length;

    // Capacitaire
    let plannedNextMonthCount = 0;
    let totalDaysMobilized = 0;
    const daysPerSkill: Record<string, number> = {};

    skills.forEach((s) => {
      daysPerSkill[s.id] = 0;
    });

    projects.forEach((p) => {
      if (p.capacityUpdatedMonth === nextMonthKey) {
        plannedNextMonthCount++;
      }
      skills.forEach((s) => {
        const d = p.capacityDaysPerSkill?.[s.id];
        if (typeof d === 'number' && !isNaN(d) && d > 0) {
          daysPerSkill[s.id] += d;
          totalDaysMobilized += d;
        }
      });
    });

    return {
      totalProjects,
      totalBudget,
      prioritizedCount,
      bonusedCount,
      plannedNextMonthCount,
      totalDaysMobilized,
      daysPerSkill,
      delayedPlanningCount: totalProjects - plannedNextMonthCount,
    };
  }, [projects, analyzedProjects, skills, nextMonthKey]);

  // Répartition des projets par état du cycle de vie
  const projectsByState = useMemo(() => {
    return projectStates.map((st) => {
      const count = projects.filter((p) => p.stateId === st.id).length;
      const percentage = projects.length > 0 ? (count / projects.length) * 100 : 0;
      return { state: st, count, percentage };
    });
  }, [projectStates, projects]);

  // Top 5 projets par ROI
  const topRoiProjects = useMemo(() => {
    const list = analyzedProjects.filter((i) => i.roi !== null);
    list.sort((a, b) => (b.roi || 0) - (a.roi || 0));
    return list.slice(0, 5);
  }, [analyzedProjects]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Identifiant',
      'Nom du projet',
      'État cycle de vie',
      'Chef de projet',
      'Budget estimé (K€)',
      'ROI calculé',
      'Bonus',
      `Mois MàJ capacitaire`,
      ...skills.map((s) => `Jours ${s.name} (${nextMonthLabel})`),
    ];

    const rows = analyzedProjects.map(({ project, state, roi }) => {
      const skillDayCols = skills.map((s) => project.capacityDaysPerSkill?.[s.id] ?? 0);
      return [
        `#${project.projectNumber}`,
        `"${project.name.replace(/"/g, '""')}"`,
        `"${(state?.name || '').replace(/"/g, '""')}"`,
        `"${project.projectManagerEmail}"`,
        project.estimatedBudget || 0,
        roi !== null ? roi.toFixed(2) : '',
        project.bonus ?? '',
        project.capacityUpdatedMonth || '',
        ...skillDayCols,
      ];
    });

    const csvContent =
      '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rapport_projets_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* En-tête de section sur le fond de page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-slate-700 shrink-0" />
            <span>Rapports & Synthèse des projets</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Consolidation analytique de l'ensemble du portefeuille : priorisation par la valeur, cycle de vie et prévisions capacitaires.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className={PRIMARY_ACTION_HEADER_BUTTON_CLASS}
          >
            <Download className="w-4 h-4" />
            <span>Exporter en CSV</span>
          </button>
        </div>
      </div>

      {/* Cartes KPI de synthèse */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Portefeuille</span>
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalProjects}</div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.prioritizedCount} projet{stats.prioritizedCount > 1 ? 's' : ''} à prioriser
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Budget Global</span>
            <Coins className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {stats.totalBudget.toLocaleString('fr-FR')} K€
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.bonusedCount} projet{stats.bonusedCount > 1 ? 's' : ''} avec bonus
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Charge requise</span>
            <Gauge className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {stats.totalDaysMobilized.toFixed(0)} j
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {(stats.totalDaysMobilized / 20).toFixed(1)} ETP requis sur {nextMonthLabel}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Planification MàJ</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {stats.plannedNextMonthCount} / {stats.totalProjects}
          </div>
          <div className="text-xs text-rose-600 font-semibold mt-1">
            {stats.delayedPlanningCount} en retard de planification
          </div>
        </div>
      </div>

      {/* Grille principale 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colonne 1 : Répartition par étape du cycle de vie */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-600" />
              <span>Répartition par cycle de vie</span>
            </h3>
            <span className="text-xs text-slate-500">{projectStates.length} étapes</span>
          </div>

          <div className="space-y-3 pt-2">
            {projectsByState.map(({ state, count, percentage }) => (
              <div key={state.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800">{state.name}</span>
                  <span className="font-bold text-slate-700">
                    {count} projet{count > 1 ? 's' : ''} ({percentage.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Colonne 2 : Top 5 projets prioritaires par ROI */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span>Top projets prioritaires (Valeur / Coût)</span>
            </h3>
            <span className="text-xs text-slate-500">Par ordre de ROI</span>
          </div>

          <div className="divide-y divide-slate-100">
            {topRoiProjects.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                Aucun projet avec calcul de ROI disponible.
              </p>
            ) : (
              topRoiProjects.map(({ project, roi }, idx) => (
                <div key={project.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold flex items-center justify-center text-[10px] shrink-0 font-mono">
                      {idx + 1}
                    </span>
                    <div className="truncate">
                      <span className="font-bold text-slate-900">#{project.projectNumber} {project.name}</span>
                      <span className="text-[11px] text-slate-500 ml-2">({project.estimatedBudget} K€)</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-xs shrink-0">
                    ROI : {formatRoi(roi)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Synthèse capacitaire consolidée par compétence clé sur le mois à venir */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Brain className="w-4 h-4 text-indigo-600" />
              <span>Besoins capacitaires consolidés par compétence clé ({nextMonthLabel})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Volume total de jours requis par les projets déclarés pour le mois à venir.
            </p>
          </div>
          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
            Total : {stats.totalDaysMobilized.toFixed(0)} j
          </span>
        </div>

        {skills.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-6 text-center">
            Aucune compétence clé déclarée dans les paramètres.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
            {skills.map((skill) => {
              const days = stats.daysPerSkill[skill.id] || 0;
              const etp = (days / 20).toFixed(1);
              return (
                <div
                  key={skill.id}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-xs text-slate-900 truncate" title={skill.name}>
                      {skill.name}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate" title={skill.resourceManagerName}>
                      RM : {skill.resourceManagerName || '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-mono text-sm font-bold ${days > 0 ? 'text-indigo-900' : 'text-slate-400'}`}>
                      {days.toFixed(1)} j
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {etp} ETP
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
