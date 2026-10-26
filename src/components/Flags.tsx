import React from 'react';

interface FlagProps {
  className?: string;
}

export const FlagFR: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg
    viewBox="0 0 900 600"
    className={`inline-block rounded-xs shadow-2xs border border-slate-300/80 overflow-hidden shrink-0 ${className}`}
    aria-label="Drapeau Français"
  >
    <rect width="300" height="600" fill="#00267f" />
    <rect x="300" width="300" height="600" fill="#ffffff" />
    <rect x="600" width="300" height="600" fill="#f31830" />
  </svg>
);

export const FlagEN: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg
    viewBox="0 0 60 30"
    className={`inline-block rounded-xs shadow-2xs border border-slate-300/80 overflow-hidden shrink-0 ${className}`}
    aria-label="Flag of the United Kingdom"
  >
    <clipPath id="flag-en-s">
      <path d="M0,0 v30 h60 v-30 z" />
    </clipPath>
    <clipPath id="flag-en-t">
      <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
    </clipPath>
    <g clipPath="url(#flag-en-s)">
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#flag-en-t)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </g>
  </svg>
);

export const FlagIT: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg
    viewBox="0 0 900 600"
    className={`inline-block rounded-xs shadow-2xs border border-slate-300/80 overflow-hidden shrink-0 ${className}`}
    aria-label="Bandiera Italiana"
  >
    <rect width="300" height="600" fill="#009246" />
    <rect x="300" width="300" height="600" fill="#ffffff" />
    <rect x="600" width="300" height="600" fill="#ce2b37" />
  </svg>
);

export const FlagDE: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg
    viewBox="0 0 5 3"
    className={`inline-block rounded-xs shadow-2xs border border-slate-300/80 overflow-hidden shrink-0 ${className}`}
    aria-label="Deutsche Flagge"
  >
    <rect width="5" height="1" y="0" fill="#000000" />
    <rect width="5" height="1" y="1" fill="#dd0000" />
    <rect width="5" height="1" y="2" fill="#ffce00" />
  </svg>
);

export const LanguageFlag: React.FC<{ code: string; className?: string }> = ({ code, className }) => {
  switch (code) {
    case 'en':
      return <FlagEN className={className} />;
    case 'it':
      return <FlagIT className={className} />;
    case 'de':
      return <FlagDE className={className} />;
    case 'fr':
    default:
      return <FlagFR className={className} />;
  }
};
