export interface Category {
  slug: string;
  name: string;
  emoji: string;
  recipesCount: number;
}

/**
 * Lista fixa din Etapa 2 (sectiunea 9 din plan). Nu toate trebuiau
 * implementate de la inceput, dar setul complet e suficient de mic
 * incat sa il populam pe tot de la inceput.
 */
export const DEFAULT_CATEGORIES: { slug: string; name: string; emoji: string }[] = [
  { slug: 'mic-dejun', name: 'Mic dejun', emoji: '🍳' },
  { slug: 'paste', name: 'Paste', emoji: '🍝' },
  { slug: 'pizza', name: 'Pizza', emoji: '🍕' },
  { slug: 'carne', name: 'Carne', emoji: '🥩' },
  { slug: 'salate', name: 'Salate', emoji: '🥗' },
  { slug: 'supe', name: 'Supe', emoji: '🍲' },
  { slug: 'deserturi', name: 'Deserturi', emoji: '🍰' },
  { slug: 'bauturi', name: 'Băuturi', emoji: '🥤' },
  { slug: 'vegetarian', name: 'Vegetarian', emoji: '🌱' },
  { slug: 'picant', name: 'Picant', emoji: '🌶️' },
];
