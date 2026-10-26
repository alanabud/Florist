/**
 * Customer-facing delivery lines for confirmation and track-order.
 * Never composes "{name}'s home" or a "Delivery Residence" label.
 * Blank street, city, state, or ZIP fragments are omitted.
 */

export function deliveryLocalityLine(city: string, state: string, zip: string): string {
  const cityState = [city.trim(), state.trim()].filter(Boolean).join(', ');
  return [cityState, zip.trim()].filter(Boolean).join(' ');
}

export function deliveryDestinationLines(input: {
  fullName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  deliverTo: string;
}): string[] {
  const lines: string[] = [];
  if (input.fullName.trim() && input.deliverTo.trim()) lines.push(input.deliverTo.trim());
  const street = input.street.trim();
  if (street) lines.push(street);
  const locality = deliveryLocalityLine(input.city, input.state, input.zip);
  if (locality) lines.push(locality);
  return lines;
}
