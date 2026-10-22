import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { ProjectState } from '../types/lifecycle';

interface LifecycleStateFilterProps {
  projectStates: ProjectState[];
  selectedStateIds: string[];
  onChange: (ids: string[]) => void;
  className?: string;
  quickFilterType?: 'prioritization' | 'staffing';
}

export const LifecycleStateFilter: React.FC<LifecycleStateFilterProps> = ({
  projectStates,
  selectedStateIds,
  onChange,
  className = '',
  quickFilterType = 'prioritization',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Trier les états selon l'ordre séquentiel du cycle de vie
  const sortedStates = useMemo(() => {
    return [...projectStates].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [projectStates]);

  const allStateIds = useMemo(() => sortedStates.map((s) => s.id), [sortedStates]);

  const isPrioritizationMode = quickFilterType === 'prioritization';

  const quickFilterStateIds = useMemo(() => {
    return sortedStates
      .filter((s) => (isPrioritizationMode ? Boolean(s.needsPrioritization) : Boolean(s.needsStaffing)))
      .map((s) => s.id);
  }, [sortedStates, isPrioritizationMode]);

  const allSelected = useMemo(() => {
    if (allStateIds.length === 0) return true;
    return allStateIds.length === selectedStateIds.length && allStateIds.every((id) => selectedStateIds.includes(id));
  }, [allStateIds, selectedStateIds]);

  const isOnlyQuickFilterSelected = useMemo(() => {
    if (quickFilterStateIds.length === 0) return false;
    if (selectedStateIds.length !== quickFilterStateIds.length) return false;
    return quickFilterStateIds.every((id) => selectedStateIds.includes(id));
  }, [quickFilterStateIds, selectedStateIds]);

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

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (allSelected) {
      onChange([]);
    } else {
      onChange(allStateIds);
    }
  };

  const handleSelectQuickFilterOnly = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(quickFilterStateIds);
  };

  const handleToggleState = (stateId: string) => {
    if (selectedStateIds.includes(stateId)) {
      onChange(selectedStateIds.filter((id) => id !== stateId));
    } else {
      onChange([...selectedStateIds, stateId]);
    }
  };

  // Libellé synthétique affiché sur le bouton
  const buttonLabel = useMemo(() => {
    if (allSelected || (selectedStateIds.length === 0 && allStateIds.length === 0)) {
      return `Tous les états (${allStateIds.length})`;
    }
    if (isOnlyQuickFilterSelected) {
      return isPrioritizationMode ? 'États à prioriser uniquement' : 'États à staffer uniquement';
    }
    if (selectedStateIds.length === 0) {
      return 'Aucun état sélectionné';
    }
    if (selectedStateIds.length === 1) {
      const single = sortedStates.find((s) => s.id === selectedStateIds[0]);
      return single ? single.name : '1 état sélectionné';
    }
    return `${selectedStateIds.length} états sélectionnés`;
  }, [allSelected, isOnlyQuickFilterSelected, isPrioritizationMode, selectedStateIds, allStateIds, sortedStates]);

  const isFilterActive = !allSelected;

  return (
    <div className={`relative ${isOpen ? 'z-30' : 'z-10'} ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full px-3 py-2 border rounded-lg text-xs bg-white text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-100'
            : isFilterActive
            ? 'border-indigo-300 bg-indigo-50/20 text-slate-800'
            : 'border-slate-300 hover:border-slate-400 text-slate-700'
        }`}
        title={buttonLabel}
      >
        <span className="truncate font-normal">{buttonLabel}</span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[270px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 text-slate-800 animate-in fade-in zoom-in-95 duration-100">
          {/* Option 1 : Tous les états avec la même case à cocher que les items du dessous */}
          <label
            className={`w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center justify-between transition-colors cursor-pointer select-none ${
              allSelected
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  if (allSelected) {
                    onChange([]);
                  } else {
                    onChange(allStateIds);
                  }
                }}
                className="w-4 h-4 rounded border-slate-400 text-slate-600 focus:ring-slate-400 focus:ring-offset-0 cursor-pointer accent-slate-600 shrink-0"
              />
              <span className="truncate">Tous les états</span>
            </div>
            <span className="text-[11px] text-slate-400 font-normal shrink-0">({sortedStates.length})</span>
          </label>

          {/* Option 2 : Les états à prioriser ou à staffer uniquement */}
          <button
            type="button"
            onClick={handleSelectQuickFilterOnly}
            className={`w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center justify-between transition-colors cursor-pointer mt-0.5 ${
              isOnlyQuickFilterSelected
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>{isPrioritizationMode ? 'Les états à prioriser uniquement' : 'Les états à staffer uniquement'}</span>
            <span className="text-[11px] text-slate-400 font-normal">({quickFilterStateIds.length})</span>
          </button>

          {/* Ligne de séparation */}
          <div className="my-1.5 border-t border-slate-200" />

          {/* Liste de tous les états du cycle de vie avec case à cocher grise à gauche */}
          <div className="max-h-60 overflow-y-auto space-y-0.5 pr-0.5">
            {sortedStates.map((state) => {
              const isChecked = selectedStateIds.includes(state.id);
              return (
                <label
                  key={state.id}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-lg cursor-pointer select-none transition-colors ${
                    isChecked
                      ? 'bg-slate-50/80 text-slate-900 font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleState(state.id)}
                    className="w-4 h-4 rounded border-slate-400 text-slate-600 focus:ring-slate-400 focus:ring-offset-0 cursor-pointer accent-slate-600 shrink-0"
                  />
                  <span className="truncate flex-1">{state.name}</span>
                </label>
              );
            })}
            {sortedStates.length === 0 && (
              <div className="text-center py-2 text-xs text-slate-400 italic">
                Aucun état défini
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
