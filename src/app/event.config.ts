/**
 * Everything that changes from one event to the next lives here: swap the
 * names and copy for the next wedding without touching any component.
 */
export const EVENT = {
  partnerOne: 'Jane',
  partnerTwo: 'Jone',
  intro: 'The wedding of',
  tagline: 'Take two photos and save your photo strip.',
  cta: 'Snap your photo now',
  poweredBy: 'Powered by',
} as const;

/** Number of shots that fill one photo strip. */
export const SHOTS_PER_STRIP = 2;
