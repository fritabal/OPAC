import React from 'react';

interface FlagProps {
  className?: string;
}

const BASE_FLAG_CLASS = 'inline-block rounded-xs shadow-2xs border border-slate-300/80 overflow-hidden shrink-0';

/**
 * France (FR)
 */
export const FlagFR: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 900 600" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="France">
    <rect width="300" height="600" fill="#00267f" />
    <rect x="300" width="300" height="600" fill="#ffffff" />
    <rect x="600" width="300" height="600" fill="#f31830" />
  </svg>
);

/**
 * Royaume-Uni / Anglais (EN)
 */
export const FlagEN: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 60 30" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="United Kingdom">
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

/**
 * Italie (IT)
 */
export const FlagIT: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 900 600" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="Italia">
    <rect width="300" height="600" fill="#009246" />
    <rect x="300" width="300" height="600" fill="#ffffff" />
    <rect x="600" width="300" height="600" fill="#ce2b37" />
  </svg>
);

/**
 * Allemagne (DE)
 */
export const FlagDE: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 5 3" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="Deutschland">
    <rect width="5" height="1" y="0" fill="#000000" />
    <rect width="5" height="1" y="1" fill="#dd0000" />
    <rect width="5" height="1" y="2" fill="#ffce00" />
  </svg>
);

/**
 * Espagne (ES)
 */
export const FlagES: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 750 500" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="España">
    <rect width="750" height="500" fill="#AA151B" />
    <rect y="125" width="750" height="250" fill="#F1BF00" />
    {/* Armoiries stylisées */}
    <g transform="translate(180, 200) scale(0.65)">
      <rect x="0" y="0" width="80" height="100" rx="10" fill="#AA151B" stroke="#F1BF00" strokeWidth="4" />
      <rect x="15" y="15" width="50" height="70" fill="#F1BF00" />
      <path d="M 40, -20 L 55, 0 L 25, 0 Z" fill="#F1BF00" />
    </g>
  </svg>
);

/**
 * Portugal (PT)
 */
export const FlagPT: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 600 400" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="Portugal">
    <rect width="240" height="400" fill="#046A38" />
    <rect x="240" width="360" height="400" fill="#DA291C" />
    <circle cx="240" cy="200" r="50" fill="#FFDD00" stroke="#000000" strokeWidth="2" />
    <rect x="220" y="180" width="40" height="40" fill="#FFFFFF" rx="4" />
    <rect x="226" y="186" width="28" height="28" fill="#00267f" rx="2" />
  </svg>
);

/**
 * Pays-Bas (NL)
 */
export const FlagNL: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 9 6" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="Nederland">
    <rect width="9" height="2" fill="#AE1C28" />
    <rect y="2" width="9" height="2" fill="#FFFFFF" />
    <rect y="4" width="9" height="2" fill="#21468B" />
  </svg>
);

/**
 * Pologne (PL)
 */
export const FlagPL: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 16 10" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="Polska">
    <rect width="16" height="5" fill="#FFFFFF" />
    <rect y="5" width="16" height="5" fill="#DC143C" />
  </svg>
);

/**
 * Russie (RU)
 */
export const FlagRU: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 9 6" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="Россия">
    <rect width="9" height="2" fill="#FFFFFF" />
    <rect y="2" width="9" height="2" fill="#0039A6" />
    <rect y="4" width="9" height="2" fill="#D52B1E" />
  </svg>
);

/**
 * Chine (ZH)
 */
export const FlagZH: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 900 600" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="中国">
    <rect width="900" height="600" fill="#DE2910" />
    {/* Grande étoile jaune */}
    <polygon points="150,50 170,110 230,110 180,150 200,210 150,170 100,210 120,150 70,110 130,110" fill="#FFDE00" />
    {/* 4 petites étoiles jaunes en arc */}
    <circle cx="300" cy="60" r="15" fill="#FFDE00" />
    <circle cx="360" cy="120" r="15" fill="#FFDE00" />
    <circle cx="360" cy="200" r="15" fill="#FFDE00" />
    <circle cx="300" cy="260" r="15" fill="#FFDE00" />
  </svg>
);

/**
 * Japon (JA)
 */
export const FlagJA: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 900 600" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="日本">
    <rect width="900" height="600" fill="#FFFFFF" />
    <circle cx="450" cy="300" r="180" fill="#BC002D" />
  </svg>
);

/**
 * Arabie Saoudite / Monde Arabe (AR)
 */
export const FlagAR: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 900 600" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="العربية">
    <rect width="900" height="600" fill="#006C35" />
    {/* Épée blanche stylisée et motif */}
    <path d="M220,380 L680,380 L650,370 L680,390 Z" fill="#FFFFFF" />
    <rect x="220" y="370" width="12" height="20" fill="#FFFFFF" rx="2" />
    <path d="M 320,280 Q 450,220 580,280 Q 450,330 320,280 Z" fill="#FFFFFF" />
  </svg>
);

/**
 * Turquie (TR)
 */
export const FlagTR: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 1200 800" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="Türkiye">
    <rect width="1200" height="800" fill="#E30A17" />
    {/* Croissant de lune blanc */}
    <circle cx="450" cy="400" r="200" fill="#FFFFFF" />
    <circle cx="500" cy="400" r="160" fill="#E30A17" />
    {/* Étoile blanche à 5 branches */}
    <polygon points="650,400 750,430 710,330 790,260 690,260 660,160 630,260 530,260 610,330 570,430" transform="scale(0.5) translate(650, 400)" fill="#FFFFFF" />
  </svg>
);

/**
 * Suède (SV)
 */
export const FlagSV: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 16 10" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="Sverige">
    <rect width="16" height="10" fill="#006AA7" />
    <rect x="5" width="2" height="10" fill="#FECC00" />
    <rect y="4" width="16" height="2" fill="#FECC00" />
  </svg>
);

/**
 * Danemark (DA)
 */
export const FlagDA: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 37 28" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="Danmark">
    <rect width="37" height="28" fill="#C8102E" />
    <rect x="12" width="4" height="28" fill="#FFFFFF" />
    <rect y="12" width="37" height="4" fill="#FFFFFF" />
  </svg>
);

/**
 * Norvège (NO)
 */
export const FlagNO: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 22 16" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="Norge">
    <rect width="22" height="16" fill="#BA0C2F" />
    <rect x="6" width="4" height="16" fill="#FFFFFF" />
    <rect y="6" width="22" height="4" fill="#FFFFFF" />
    <rect x="7" width="2" height="16" fill="#00205B" />
    <rect y="7" width="22" height="2" fill="#00205B" />
  </svg>
);

/**
 * Finlande (FI)
 */
export const FlagFI: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 18 11" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="Suomi">
    <rect width="18" height="11" fill="#FFFFFF" />
    <rect x="5" width="3" height="11" fill="#002F6C" />
    <rect y="4" width="18" height="3" fill="#002F6C" />
  </svg>
);

/**
 * Grèce (EL)
 */
export const FlagEL: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 27 18" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="Ελλάδα">
    <rect width="27" height="18" fill="#0D5EAF" />
    <rect y="2" width="27" height="2" fill="#FFFFFF" />
    <rect y="6" width="27" height="2" fill="#FFFFFF" />
    <rect y="10" width="27" height="2" fill="#FFFFFF" />
    <rect y="14" width="27" height="2" fill="#FFFFFF" />
    <rect width="10" height="10" fill="#0D5EAF" />
    <rect x="4" width="2" height="10" fill="#FFFFFF" />
    <rect y="4" width="10" height="2" fill="#FFFFFF" />
  </svg>
);

/**
 * République Tchèque (CS)
 */
export const FlagCS: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 900 600" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="Česko">
    <rect width="900" height="300" fill="#FFFFFF" />
    <rect y="300" width="900" height="300" fill="#D7141A" />
    <polygon points="0,0 450,300 0,600" fill="#11457E" />
  </svg>
);

/**
 * Roumanie (RO)
 */
export const FlagRO: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 9 6" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="România">
    <rect width="3" height="6" fill="#002B7F" />
    <rect x="3" width="3" height="6" fill="#FCD116" />
    <rect x="6" width="3" height="6" fill="#CE1126" />
  </svg>
);

/**
 * Hongrie (HU)
 */
export const FlagHU: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 6 3" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="Magyarország">
    <rect width="6" height="1" fill="#CE2939" />
    <rect y="1" width="6" height="1" fill="#FFFFFF" />
    <rect y="2" width="6" height="1" fill="#477050" />
  </svg>
);

/**
 * Brésil (PT-BR)
 */
export const FlagBR: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 720 504" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="Brasil">
    <rect width="720" height="504" fill="#009C3B" />
    <polygon points="360,42 666,252 360,462 54,252" fill="#FFDF00" />
    <circle cx="360" cy="252" r="105" fill="#002776" />
    {/* Bande blanche courbée */}
    <path d="M 260,260 Q 360,225 460,250 Q 360,210 260,260 Z" fill="#FFFFFF" />
  </svg>
);

/**
 * Corée du Sud (KO)
 */
export const FlagKO: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 900 600" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="한국">
    <rect width="900" height="600" fill="#FFFFFF" />
    {/* Taegeuk cercle bicolore rouge et bleu */}
    <circle cx="450" cy="300" r="150" fill="#CD2E3A" />
    <path d="M 450,150 A 150,150 0 0,0 450,450 A 75,75 0 0,0 450,300 A 75,75 0 0,1 450,150 Z" fill="#0047A0" />
    {/* 4 Trigrammes d'angles stylisés */}
    <g fill="#000000">
      <rect x="180" y="100" width="12" height="70" rx="3" transform="rotate(-30 180 100)" />
      <rect x="200" y="90" width="12" height="70" rx="3" transform="rotate(-30 200 90)" />
      <rect x="680" y="420" width="12" height="70" rx="3" transform="rotate(-30 680 420)" />
      <rect x="700" y="410" width="12" height="70" rx="3" transform="rotate(-30 700 410)" />
    </g>
  </svg>
);

/**
 * Ukraine (UK)
 */
export const FlagUKR: React.FC<FlagProps> = ({ className = 'w-5 h-3.5' }) => (
  <svg viewBox="0 0 9 6" className={`${BASE_FLAG_CLASS} ${className}`} aria-label="Україна">
    <rect width="9" height="3" fill="#005BBB" />
    <rect y="3" width="9" height="3" fill="#FFD500" />
  </svg>
);

/**
 * Composant universel de drapeau vectoriel avec correspondance exacte
 */
export const LanguageFlag: React.FC<{ code: string; className?: string }> = ({
  code,
  className = 'w-5 h-3.5',
}) => {
  const normalized = (code || '').toLowerCase().trim();

  switch (normalized) {
    case 'fr':
      return <FlagFR className={className} />;
    case 'en':
    case 'en-gb':
    case 'en-us':
      return <FlagEN className={className} />;
    case 'it':
      return <FlagIT className={className} />;
    case 'de':
      return <FlagDE className={className} />;
    case 'es':
      return <FlagES className={className} />;
    case 'pt':
      return <FlagPT className={className} />;
    case 'pt-br':
    case 'br':
      return <FlagBR className={className} />;
    case 'nl':
    case 'nl-be':
      return <FlagNL className={className} />;
    case 'pl':
      return <FlagPL className={className} />;
    case 'ru':
      return <FlagRU className={className} />;
    case 'zh':
    case 'zh-cn':
      return <FlagZH className={className} />;
    case 'ja':
      return <FlagJA className={className} />;
    case 'ar':
      return <FlagAR className={className} />;
    case 'tr':
      return <FlagTR className={className} />;
    case 'sv':
      return <FlagSV className={className} />;
    case 'da':
      return <FlagDA className={className} />;
    case 'no':
    case 'nb':
    case 'nn':
      return <FlagNO className={className} />;
    case 'fi':
      return <FlagFI className={className} />;
    case 'el':
      return <FlagEL className={className} />;
    case 'cs':
      return <FlagCS className={className} />;
    case 'ro':
      return <FlagRO className={className} />;
    case 'hu':
      return <FlagHU className={className} />;
    case 'ko':
      return <FlagKO className={className} />;
    case 'uk':
      return <FlagUKR className={className} />;
    default:
      return <FlagFR className={className} />;
  }
};
