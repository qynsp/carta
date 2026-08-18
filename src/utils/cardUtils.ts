import { CardValue } from '../types';

export function getCardLabel(value: CardValue): string {
  switch (value) {
    case 1:
      return 'A';
    case 11:
      return 'J';
    case 12:
      return 'Q';
    case 13:
      return 'K';
    default:
      return String(value);
  }
}

export function getCardFullName(value: CardValue): string {
  switch (value) {
    case 1:
      return 'Ace';
    case 11:
      return 'Jack';
    case 12:
      return 'Queen';
    case 13:
      return 'King';
    default:
      return String(value);
  }
}

export interface PoolBallColor {
  number: number;
  bg: string;
  text: string;
  isStripe: boolean;
  name: string;
}

export const POOL_BALL_COLORS: Record<number, PoolBallColor> = {
  1: { number: 1, bg: '#eab308', text: '#000000', isStripe: false, name: 'Yellow (A)' },
  2: { number: 2, bg: '#2563eb', text: '#ffffff', isStripe: false, name: 'Blue (2)' },
  3: { number: 3, bg: '#dc2626', text: '#ffffff', isStripe: false, name: 'Red (3)' },
  4: { number: 4, bg: '#7c3aed', text: '#ffffff', isStripe: false, name: 'Purple (4)' },
  5: { number: 5, bg: '#ea580c', text: '#ffffff', isStripe: false, name: 'Orange (5)' },
  6: { number: 6, bg: '#16a34a', text: '#ffffff', isStripe: false, name: 'Green (6)' },
  7: { number: 7, bg: '#831843', text: '#ffffff', isStripe: false, name: 'Maroon (7)' },
  8: { number: 8, bg: '#09090b', text: '#ffffff', isStripe: false, name: 'Black (8)' },
  9: { number: 9, bg: '#eab308', text: '#000000', isStripe: true, name: 'Yellow Stripe (9)' },
  10: { number: 10, bg: '#2563eb', text: '#ffffff', isStripe: true, name: 'Blue Stripe (10)' },
  11: { number: 11, bg: '#dc2626', text: '#ffffff', isStripe: true, name: 'Red Stripe (J)' },
  12: { number: 12, bg: '#7c3aed', text: '#ffffff', isStripe: true, name: 'Purple Stripe (Q)' },
  13: { number: 13, bg: '#ea580c', text: '#ffffff', isStripe: true, name: 'Orange Stripe (K)' },
  14: { number: 14, bg: '#16a34a', text: '#ffffff', isStripe: true, name: 'Green Stripe (14 - Neutral)' },
  15: { number: 15, bg: '#831843', text: '#ffffff', isStripe: true, name: 'Maroon Stripe (15 - Neutral)' },
};
