import React, { forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import {
  SEARCH_INPUT_BASE_CLASS,
  SEARCH_BUTTON_CLASS,
  SEARCH_CLEAR_BUTTON_CLASS,
} from '../constants/ui';

export interface SearchFilterInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  onSubmit?: () => void;
  placeholder?: string;
  showSearchButton?: boolean;
  searchButtonTitle?: string;
  clearButtonTitle?: string;
  containerClassName?: string;
  searchButtonTooltipWrapper?: (button: React.ReactNode) => React.ReactNode;
}

/**
 * Boîte de saisie unifiée pour la recherche et le filtrage d'items
 * Rendu standardisé :
 * 1) Filet sans focus gris léger (border border-slate-300)
 * 2) Fond très clair (bg-white text-slate-800 placeholder-slate-400)
 * 3) Au focus : filet unique sans double contour, bleu soutenu (focus:outline-none focus:border-indigo-600 focus:ring-0)
 */
export const SearchFilterInput = forwardRef<HTMLInputElement, SearchFilterInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      onSubmit,
      placeholder,
      showSearchButton = false,
      searchButtonTitle = 'Rechercher',
      clearButtonTitle = 'Effacer la recherche',
      containerClassName = '',
      className = '',
      searchButtonTooltipWrapper,
      ...restProps
    },
    ref
  ) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
      if (restProps.onKeyDown) {
        restProps.onKeyDown(e);
      }
    };

    const handleClear = () => {
      onChange('');
      if (onClear) {
        onClear();
      }
    };

    // Mode avec bouton de validation séparé (ex: Onglet Utilisateurs, Internationalisation)
    if (showSearchButton) {
      const searchButton = (
        <button
          type="button"
          onClick={onSubmit}
          className={SEARCH_BUTTON_CLASS}
          title={searchButtonTitle}
          aria-label={searchButtonTitle}
        >
          <Search className="w-4 h-4" />
        </button>
      );

      return (
        <div className={`flex items-center gap-2 ${containerClassName}`}>
          <div className="relative flex-1">
            <input
              ref={ref}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={`w-full pl-3 pr-8 ${SEARCH_INPUT_BASE_CLASS} ${className}`}
              {...restProps}
            />
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${SEARCH_CLEAR_BUTTON_CLASS}`}
                title={clearButtonTitle}
                aria-label={clearButtonTitle}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {searchButtonTooltipWrapper ? searchButtonTooltipWrapper(searchButton) : searchButton}
        </div>
      );
    }

    // Mode standard avec pictogramme intégré à gauche et croix d'effacement à droite (ex: Priorités, Capacitaire, Indisponibilité)
    return (
      <div className={`relative ${containerClassName}`}>
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full pl-9 pr-8 ${SEARCH_INPUT_BASE_CLASS} ${className}`}
          {...restProps}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${SEARCH_CLEAR_BUTTON_CLASS}`}
            title={clearButtonTitle}
            aria-label={clearButtonTitle}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }
);

SearchFilterInput.displayName = 'SearchFilterInput';

export default SearchFilterInput;
