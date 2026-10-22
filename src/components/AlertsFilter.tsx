import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, AlertTriangle } from 'lucide-react';

interface AlertsFilterProps {
  filterCapacityOverruns: boolean;
  filterBudgetOverruns: boolean;
  filterOutdatedStaffingDemands?: boolean;
  onToggleCapacityOverruns: (val: boolean) => void;
  onToggleBudgetOverruns: (val: boolean) => void;
  onToggleOutdatedStaffingDemands?: (val: boolean) => void;
  onSelectAllProjects: () => void;
  capacityOverrunCount?: number;
  budgetOverrunCount?: number;
  outdatedStaffingDemandsCount?: number;
  className?: string;
}

export const AlertsFilter: React.FC<AlertsFilterProps> = ({
  filterCapacityOverruns,
  filterBudgetOverruns,
  filterOutdatedStaffingDemands = false,
  onToggleCapacityOverruns,
  onToggleBudgetOverruns,
  onToggleOutdatedStaffingDemands,
  onSelectAllProjects,
  capacityOverrunCount = 0,
  budgetOverrunCount = 0,
  outdatedStaffingDemandsCount = 0,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isFilterActive =
    filterCapacityOverruns || filterBudgetOverruns || filterOutdatedStaffingDemands;

  // Fermer le dropdown lors d'un clic extérieur ou touche Échap
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Libellé synthétique affiché sur le bouton
  const buttonLabel = useMemo(() => {
    const activeCount =
      (filterCapacityOverruns ? 1 : 0) +
      (filterBudgetOverruns ? 1 : 0) +
      (filterOutdatedStaffingDemands ? 1 : 0);

    if (activeCount > 1) {
      if (filterCapacityOverruns && filterBudgetOverruns && !filterOutdatedStaffingDemands) {
        return 'Dépassements cap. & budg.';
      }
      return `Alertes (${activeCount})`;
    }
    if (filterCapacityOverruns) {
      return 'Dépassements capacitaires';
    }
    if (filterBudgetOverruns) {
      return 'Dépassements budgétaires';
    }
    if (filterOutdatedStaffingDemands) {
      return 'Staffing non à jour';
    }
    return 'Les alertes';
  }, [filterCapacityOverruns, filterBudgetOverruns, filterOutdatedStaffingDemands]);

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectAllProjects();
    setIsOpen(false);
  };

  return (
    <div className={`relative ${isOpen ? 'z-30' : 'z-10'} ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full px-3 py-2 border rounded-lg text-xs bg-white text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-100'
            : isFilterActive
            ? 'border-rose-400 bg-rose-50/40 text-rose-900 font-medium'
            : 'border-slate-300 hover:border-slate-400 text-slate-700'
        }`}
        title={`Filtre : ${buttonLabel}`}
      >
        <span className="truncate flex items-center gap-1.5 font-normal">
          {isFilterActive && <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
          <span className="truncate">{buttonLabel}</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[280px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 text-slate-800 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Les alertes
          </div>

          {/* Option 1 : Tous les projets (sans case à cocher) */}
          <button
            type="button"
            onClick={handleSelectAll}
            className={`w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
              !isFilterActive
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>Tous les projets</span>
            {!isFilterActive && (
              <span className="text-[11px] text-slate-500 font-normal">Actif</span>
            )}
          </button>

          {/* Ligne de séparation */}
          <div className="my-1.5 border-t border-slate-200" />

          {/* Option 2 : Les dépassements capacitaires avec boîte à cocher à gauche */}
          <label
            className={`flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-lg cursor-pointer select-none transition-colors ${
              filterCapacityOverruns
                ? 'bg-rose-50 text-rose-900 font-medium'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <input
              type="checkbox"
              checked={filterCapacityOverruns}
              onChange={(e) => onToggleCapacityOverruns(e.target.checked)}
              className="w-4 h-4 rounded border-slate-400 text-slate-600 focus:ring-slate-400 focus:ring-offset-0 cursor-pointer accent-slate-600 shrink-0"
            />
            <span className="truncate flex-1">Les dépassements capacitaires</span>
            {capacityOverrunCount > 0 && (
              <span className="text-[10px] font-semibold text-rose-700 bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded-full shrink-0">
                {capacityOverrunCount}
              </span>
            )}
          </label>

          {/* Option 3 : Les dépassements budgétaires avec boîte à cocher à gauche */}
          <label
            className={`flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-lg cursor-pointer select-none transition-colors mt-0.5 ${
              filterBudgetOverruns
                ? 'bg-amber-50 text-amber-900 font-medium'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <input
              type="checkbox"
              checked={filterBudgetOverruns}
              onChange={(e) => onToggleBudgetOverruns(e.target.checked)}
              className="w-4 h-4 rounded border-slate-400 text-slate-600 focus:ring-slate-400 focus:ring-offset-0 cursor-pointer accent-slate-600 shrink-0"
            />
            <span className="truncate flex-1">Les dépassements budgétaires</span>
            {budgetOverrunCount > 0 && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">
                {budgetOverrunCount}
              </span>
            )}
          </label>

          {/* Option 4 : Les projets non mis à jour de leurs demandes de staffing */}
          <label
            className={`flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-lg cursor-pointer select-none transition-colors mt-0.5 ${
              filterOutdatedStaffingDemands
                ? 'bg-orange-50 text-orange-900 font-medium'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <input
              type="checkbox"
              checked={filterOutdatedStaffingDemands}
              onChange={(e) => onToggleOutdatedStaffingDemands?.(e.target.checked)}
              className="w-4 h-4 rounded border-slate-400 text-slate-600 focus:ring-slate-400 focus:ring-offset-0 cursor-pointer accent-slate-600 shrink-0"
            />
            <span className="truncate flex-1">Staffing non à jour</span>
            {outdatedStaffingDemandsCount > 0 && (
              <span className="text-[10px] font-semibold text-orange-700 bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded-full shrink-0">
                {outdatedStaffingDemandsCount}
              </span>
            )}
          </label>
        </div>
      )}
    </div>
  );
};
