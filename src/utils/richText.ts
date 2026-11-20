/**
 * Utilitaires pour le calcul de longueur textuelle et la normalisation
 * des champs de texte enrichi (contentEditable / HTML).
 */

/**
 * Retourne le nombre de caractères visibles dans un élément DOM éditable,
 * en ignorant les espaces de largeur nulle (\u200B) utilisés pour le curseur
 * et les sauts de ligne finaux ajoutés par le navigateur.
 */
export function getElementTextLength(el: HTMLElement | null): number {
  if (!el) return 0;
  const rawText = el.innerText || '';
  return rawText.replace(/\u200B/g, '').replace(/\r?\n+$/, '').length;
}

/**
 * Calcule le nombre de caractères visibles à partir d'une chaîne HTML ou texte brut.
 */
export function getRichTextLength(htmlOrText: string): number {
  if (!htmlOrText) return 0;

  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    // Préserver les sauts de ligne entre blocs (<p>, <div>, <li>, <br>) pour rester fidèle à innerText
    const normalized = htmlOrText
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<(p|div|li|h[1-6])\b[^>]*>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '');
    div.innerHTML = normalized;
    const text = (div.textContent || '')
      .replace(/\u200B/g, '')
      .replace(/^\n+/, '')
      .replace(/\r?\n+$/, '');
    return text.length;
  }

  return htmlOrText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\u200B/g, '')
    .replace(/\r?\n+$/, '').length;
}

/**
 * Normalise le HTML d'un conteneur contentEditable : renvoie '' si le contenu
 * visible est vide (ex. '<br>' ou '<p><br></p>' laissé par le navigateur).
 */
export function normalizeEditableHtml(el: HTMLElement | null): { html: string; textLength: number } {
  if (!el) return { html: '', textLength: 0 };
  const textLength = getElementTextLength(el);
  let html = el.innerHTML.trim();
  if (html === '<br>' || html === '<p><br></p>' || html === '<div><br></div>' || textLength === 0) {
    html = '';
  }
  return { html, textLength };
}
