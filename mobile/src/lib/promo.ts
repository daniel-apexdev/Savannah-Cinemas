/**
 * A promo code picked on the Events tab ("Use code"), waiting for the
 * next seat selection. In memory only: it's a hand-off, not a setting.
 */
let pending = '';

export function setPendingPromo(code: string) {
  pending = code.trim().toUpperCase();
}

/** Returns the waiting code (if any) and clears it. */
export function takePendingPromo() {
  const code = pending;
  pending = '';
  return code;
}

export function peekPendingPromo() {
  return pending;
}
