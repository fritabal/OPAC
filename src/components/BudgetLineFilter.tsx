import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { BudgetLine } from '../types/budget';

interface BudgetLineFilterProps {
  budgetLines: BudgetLine[];
  selectedBudgetLineIds: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}

export const BudgetLineFilter: React.FC<BudgetLineFilterProps> = ({
  budgetLines,
  selectedBudgetLineIds,
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Trier les lignes budgétaires selon leur ordre défini ou par nom
  const sortedBudgetLines = useMemo(() => {
    return [...budgetLines].sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
    });
  }, [budgetLines]);

  const allBudgetLineIds = useMemo(
    () => sortedBudgetLines.map((b) => b.id),
    [sortedBudgetLines]
  );

  const allSelected = useMemo(() => {
    if (allBudgetLineIds.length === 0) return true;
    return (
      allBudgetLineIds.length === selectedBudgetLineIds.length &&
      allBudgetLineIds.every((id) => selectedBudgetLineIds.includes(id))
    );
  }, [allBudgetLineIds, selectedBudgetLineIds]);

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

  const handleSelectAllToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (allSelected) {
      onChange([]);
    } else {
      onChange(allBudgetLineIds);
    }
  };

  const handleToggleBudgetLine = (lineId: string) => {
    if (selectedBudgetLineIds.includes(lineId)) {
      onChange(selectedBudgetLineIds.filter((id) => id !== lineId));
    } else {
      onChange([...selectedBudgetLineIds, lineId]);
    }
  };

  // Libellé synthétique affiché sur le bouton
  const buttonLabel = useMemo(() => {
    if (allSelected || (selectedBudgetLineIds.length === 0 && allBudgetLineIds.length === 0)) {
      return `Toutes les lignes budgétaires (${allBudgetLineIds.length})`;
    }
    if (selectedBudgetLineIds.length === 0) {
      return 'Aucune ligne budgétaire';
    }
    if (selectedBudgetLineIds.length === 1) {
      const single = sortedBudgetLines.find((b) => b.id === selectedBudgetLineIds[0]);
      return single ? single.name : '1 ligne budgétaire';
    }
    return `${selectedBudgetLineIds.length} lignes budgétaires`;
  }, [allSelected, selectedBudgetLineIds, allBudgetLineIds, sortedBudgetLines]);

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
          {/* Option 1 : Toutes les lignes budgétaires avec la même case à cocher que les items du dessous */}
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
                    onChange(allBudgetLineIds);
                  }
                }}
                className="w-4 h-4 rounded border-slate-400 text-slate-600 focus:ring-slate-400 focus:ring-offset-0 cursor-pointer accent-slate-600 shrink-0"
              />
              <span className="truncate">Toutes les lignes budgétaires</span>
            </div>
            <span className="text-[11px] text-slate-400 font-normal shrink-0">
              ({sortedBudgetLines.length})
            </span>
          </label>

          {/* Ligne de séparation */}
          <div className="my-1.5 border-t border-slate-200" />

          {/* Liste de toutes les lignes budgétaires avec une case à cocher devant chacune */}
          <div className="max-h-60 overflow-y-auto space-y-0.5 pr-0.5">
            {sortedBudgetLines.map((line) => {
              const isChecked = selectedBudgetLineIds.includes(line.id);
              return (
                <label
                  key={line.id}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-lg cursor-pointer select-none transition-colors ${
                    isChecked
                      ? 'bg-slate-50/80 text-slate-900 font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleBudgetLine(line.id)}
                    className="w-4 h-4 rounded border-slate-400 text-slate-600 focus:ring-slate-400 focus:ring-offset-0 cursor-pointer accent-slate-600 shrink-0"
                  />
                  <span className="truncate flex-1" title={line.name}>
                    {line.name}
                  </span>
                </label>
              );
            })}
            {sortedBudgetLines.length === 0 && (
              <div className="text-center py-2 text-xs text-slate-400 italic">
                Aucune ligne budgétaire définie
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
