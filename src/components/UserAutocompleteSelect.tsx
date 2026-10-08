import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';
import { AppUser, UserRole } from '../types/user';
import { getUserRoles, normalizeForSearch } from '../utils/userUtils';

interface UserAutocompleteSelectProps {
  value: string; // id ou email selon valueKey
  onChange: (value: string, user?: AppUser) => void;
  users: AppUser[];
  valueKey?: 'id' | 'email';
  requiredRole?: UserRole; // Pré-filtrage strict sur un rôle précis (ex: 'resource manager', 'chef de projet')
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  excludeValue?: string; // id ou email à exclure (ex: chef de projet exclu pour l'adjoint)
  allowClear?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const UserAutocompleteSelect: React.FC<UserAutocompleteSelectProps> = ({
  value,
  onChange,
  users,
  valueKey = 'email',
  requiredRole,
  placeholder = 'Rechercher un utilisateur...',
  required = false,
  disabled = false,
  excludeValue,
  allowClear = false,
  className = '',
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Recherche de l'utilisateur actuellement sélectionné
  const selectedUser = useMemo(() => {
    if (!value) return null;
    return users.find((u) => {
      if (valueKey === 'id') {
        return u.id === value;
      }
      return (u.email || '').toLowerCase() === value.toLowerCase();
    });
  }, [users, value, valueKey]);

  // Liste des utilisateurs disponibles pré-filtrés sur le rôle requis et hors exclu
  const availableUsers = useMemo(() => {
    return users.filter((u) => {
      const uVal = valueKey === 'id' ? u.id : (u.email || '').toLowerCase();
      const exclVal = excludeValue ? (valueKey === 'id' ? excludeValue : excludeValue.toLowerCase()) : null;

      // Exclure l'utilisateur spécifié dans excludeValue
      if (exclVal && uVal === exclVal) {
        return false;
      }

      // Pré-filtrage strict sur le profil / rôle requis
      if (requiredRole) {
        const roles = getUserRoles(u);
        const hasRequiredRole = roles.includes(requiredRole);

        // Si l'utilisateur est déjà celui sélectionné, on le conserve pour ne pas casser l'affichage
        const isCurrentSelected = value && (valueKey === 'id' ? u.id === value : (u.email || '').toLowerCase() === value.toLowerCase());
        if (isCurrentSelected) {
          return true;
        }

        return hasRequiredRole;
      }

      return true;
    });
  }, [users, excludeValue, requiredRole, value, valueKey]);

  // Filtrage dynamique sur la séquence de lettres tapée par l'utilisateur
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return availableUsers;
    const cleanSearch = normalizeForSearch(searchTerm);

    return availableUsers.filter((u) => {
      const name = normalizeForSearch(u.displayName || '');
      const email = normalizeForSearch(u.email || '');
      return name.includes(cleanSearch) || email.includes(cleanSearch);
    });
  }, [availableUsers, searchTerm]);

  // Fermer la liste au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus sur le champ de recherche à l'ouverture
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (user: AppUser) => {
    const chosenValue = valueKey === 'id' ? user.id : user.email;
    onChange(chosenValue, user);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setIsOpen(false);
  };

  const isSmall = size === 'sm';

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* 1. Mode Affichage (fermé) */}
      {!isOpen ? (
        <div
          onClick={() => {
            if (!disabled) {
              setIsOpen(true);
              setSearchTerm('');
            }
          }}
          className={`w-full rounded-lg border text-xs flex items-center justify-between gap-2 transition-all select-none ${
            isSmall ? 'min-h-[34px] px-2.5 py-1' : 'min-h-[38px] px-3 py-1.5'
          } ${
            disabled
              ? 'bg-slate-100 border-slate-200 cursor-not-allowed text-slate-500'
              : 'bg-white border-slate-300 hover:border-slate-400 cursor-pointer shadow-2xs hover:bg-slate-50/50'
          } ${required && !value ? 'border-amber-300 ring-1 ring-amber-200' : ''}`}
        >
          {selectedUser ? (
            <span className="font-semibold text-slate-900 truncate">
              {selectedUser.displayName}
            </span>
          ) : (
            <span className="text-slate-400 italic truncate">
              {placeholder}
            </span>
          )}

          <div className="flex items-center gap-1 shrink-0">
            {allowClear && value && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                title="Effacer la sélection"
              >
                <X className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
              </button>
            )}
            {!disabled && (
              <ChevronDown className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-slate-400`} />
            )}
          </div>
        </div>
      ) : (
        /* 2. Mode Recherche par séquence de lettres (ouvert) */
        <div className="relative w-full">
          <div className="relative">
            <Search
              className={`text-indigo-500 absolute left-2.5 ${
                isSmall ? 'top-2 w-3.5 h-3.5' : 'top-2.5 w-3.5 h-3.5'
              } pointer-events-none`}
            />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tapez des lettres..."
              className={`w-full pl-8 pr-7 border-2 border-indigo-500 rounded-lg text-xs font-medium focus:outline-none bg-white shadow-sm ${
                isSmall ? 'py-1.5' : 'py-2'
              }`}
            />
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Menu déroulant des propositions : affichage uniquement du nom */}
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((u) => {
                const isCurrent =
                  value &&
                  (valueKey === 'id' ? u.id === value : (u.email || '').toLowerCase() === value.toLowerCase());

                return (
                  <div
                    key={u.id || u.email}
                    onClick={() => handleSelect(u)}
                    className={`px-3 py-2 flex items-center justify-between gap-2.5 cursor-pointer text-xs transition-colors ${
                      isCurrent
                        ? 'bg-indigo-50 text-indigo-900 font-bold'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <span className="truncate">{u.displayName}</span>
                    {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                  </div>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-slate-400 italic">
                {searchTerm.trim() ? (
                  <>Aucun utilisateur correspondant à « {searchTerm} »</>
                ) : (
                  <>Aucun utilisateur disponible</>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
