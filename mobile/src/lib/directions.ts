import { Linking } from 'react-native';

/** Where Savannah Cinemas Accra is. Used when the server's address is missing or vague. */
export const ACCRA_MALL = {
  label: 'Accra Mall, Spintex Road, Accra, Ghana',
  // Plot C11, Tetteh Quarshie Interchange
  lat: 5.62217,
  lng: -0.17331,
};

/**
 * Turn-by-turn directions in Google Maps (the app if installed,
 * otherwise the browser). Goes to the cinema's address when it names
 * a place, else straight to Accra Mall.
 */
export function directionsUrl(cinema?: { address?: string | null; city?: string | null } | null) {
  const address = (cinema?.address ?? '').trim();
  const specific = address.length > 0 && address.toLowerCase() !== (cinema?.city ?? '').trim().toLowerCase();
  const destination = specific
    ? [address, cinema?.city, /ghana/i.test(address) ? null : 'Ghana'].filter(Boolean).join(', ')
    : ACCRA_MALL.label;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function openDirections(cinema?: { address?: string | null; city?: string | null } | null) {
  Linking.openURL(directionsUrl(cinema)).catch(() => {});
}
