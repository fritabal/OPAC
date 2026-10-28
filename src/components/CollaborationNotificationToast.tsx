import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  Scale,
  Gauge,
  Briefcase,
  Sliders,
  Coins,
  Layers,
  Users,
  AlertCircle,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import {
  CollaborationNotification,
  NotificationCategory,
} from '../services/collaborationNotificationService';

interface NotificationToastItemProps {
  notification: CollaborationNotification;
  onDismiss: (id: string) => void;
  durationMs?: number;
}

function getCategoryIcon(category: NotificationCategory) {
  switch (category) {
    case 'project_prioritization':
      return {
        icon: Scale,
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        border: 'border-purple-300',
        tagBg: 'bg-purple-50 text-purple-800 border-purple-200',
        label: 'Priorités',
      };
    case 'project_staffing':
      return {
        icon: Gauge,
        bg: 'bg-teal-100',
        text: 'text-teal-700',
        border: 'border-teal-300',
        tagBg: 'bg-teal-50 text-teal-800 border-teal-200',
        label: 'Capacitaire & Staffing',
      };
    case 'project_created':
      return {
        icon: PlusCircle,
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        border: 'border-emerald-300',
        tagBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        label: 'Nouveau projet',
      };
    case 'project_deleted':
      return {
        icon: Trash2,
        bg: 'bg-rose-100',
        text: 'text-rose-700',
        border: 'border-rose-300',
        tagBg: 'bg-rose-50 text-rose-800 border-rose-200',
        label: 'Projet supprimé',
      };
    case 'settings_criteria':
      return {
        icon: Sliders,
        bg: 'bg-indigo-100',
        text: 'text-indigo-700',
        border: 'border-indigo-300',
        tagBg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        label: 'Paramètres critères',
      };
    case 'settings_bonus':
      return {
        icon: Coins,
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        border: 'border-amber-300',
        tagBg: 'bg-amber-50 text-amber-800 border-amber-200',
        label: 'Paramètres bonus',
      };
    case 'settings_lifecycle':
      return {
        icon: Layers,
        bg: 'bg-sky-100',
        text: 'text-sky-700',
        border: 'border-sky-300',
        tagBg: 'bg-sky-50 text-sky-800 border-sky-200',
        label: 'Cycle de vie',
      };
    case 'settings_resources':
    case 'settings_skills':
      return {
        icon: Users,
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-300',
        tagBg: 'bg-blue-50 text-blue-800 border-blue-200',
        label: 'Ressources & Compétences',
      };
    default:
      return {
        icon: Briefcase,
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-300',
        tagBg: 'bg-blue-50 text-blue-800 border-blue-200',
        label: 'Projet',
      };
  }
}

const NotificationToastItem: React.FC<NotificationToastItemProps> = ({
  notification,
  onDismiss,
  durationMs = 5000,
}) => {
  const [timeLeft, setTimeLeft] = useState(durationMs);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPaused) return;

    const interval = 50; // mise à jour toutes les 50ms pour une barre fluide
    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= interval) {
          if (timerRef.current) clearInterval(timerRef.current);
          onDismiss(notification.id);
          return 0;
        }
        return prev - interval;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, notification.id, onDismiss]);

  const progressPercent = Math.max(0, Math.min(100, (timeLeft / durationMs) * 100));
  const categoryStyle = getCategoryIcon(notification.category);
  const IconComponent = categoryStyle.icon;

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/90 overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-top-3 flex flex-col hover:shadow-2xl"
      role="alert"
    >
      <div className="p-3.5 space-y-2">
        {/* En-tête de la notification : Pictogramme + Titre + Bouton Fermer */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`p-1.5 rounded-lg shrink-0 ${categoryStyle.bg} ${categoryStyle.text} border ${categoryStyle.border}`}
            >
              <IconComponent className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-900 leading-tight">
                  {notification.title || 'Mise à jour en temps réel'}
                </span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md border ${categoryStyle.tagBg}`}
                >
                  {categoryStyle.label}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onDismiss(notification.id)}
            className="inline-flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md text-xs font-semibold transition-colors cursor-pointer shrink-0 ml-1"
            title="Fermer cette notification"
          >
            <span>Fermer</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Corps du message */}
        <p className="text-xs text-slate-700 leading-relaxed font-normal">
          {notification.message}
        </p>

        {/* Auteur et horodatage */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
          <span className="truncate max-w-[200px]">
            {notification.actorEmail ? `Par ${notification.actorEmail}` : 'Par un autre utilisateur'}
          </span>
          <span className="italic shrink-0 ml-2">
            Disparaît dans {Math.ceil(timeLeft / 1000)}s
          </span>
        </div>
      </div>

      {/* Barre de progression du décompte de 5 secondes */}
      <div className="w-full h-1 bg-slate-100 overflow-hidden">
        <div
          className={`h-full transition-all ease-linear ${
            notification.category === 'project_prioritization'
              ? 'bg-purple-600'
              : notification.category === 'project_staffing'
              ? 'bg-teal-600'
              : 'bg-blue-600'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};

interface CollaborationNotificationToastProps {
  notifications: CollaborationNotification[];
  onDismiss: (id: string) => void;
}

export const CollaborationNotificationToast: React.FC<CollaborationNotificationToastProps> = ({
  notifications,
  onDismiss,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 sm:right-6 z-50 flex flex-col gap-2.5 max-w-sm sm:max-w-md w-[calc(100vw-2rem)] pointer-events-none">
      {notifications.map((notif) => (
        <NotificationToastItem
          key={notif.id}
          notification={notif}
          onDismiss={onDismiss}
          durationMs={5000}
        />
      ))}
    </div>
  );
};
