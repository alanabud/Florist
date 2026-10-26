/**
 * Checkout minors — pickup address is not required, delivery still is,
 * and the quote does not bake a delivery fee or destination tax early.
 */
import {
  hasDeliveryAddress,
  hasRecipientContact,
  isPastFulfillmentDate,
  isValidPhone,
  isValidZip,
  quoteCheckout,
  todayIsoDate,
  validateCheckoutStep,
} from './src/services/checkoutValidation.ts';
import { SITE_CONFIG, studioPickupBodyLines } from './src/config/siteConfig.ts';
import { deliveryDestinationLines } from './src/services/fulfillmentDisplay.ts';

let failed = 0;
const assert = (cond, message) => {
  if (!cond) {
    console.error(`❌ ${message}`);
    failed += 1;
  } else {
    console.log(`✅ ${message}`);
  }
};

const base = {
  recipientName: 'Test Recipient',
  recipientPhone: '(407) 555-0199',
  recipientAddress: '',
  recipientCity: '',
  recipientState: 'FL',
  recipientZip: '',
};

assert(hasRecipientContact(base), 'Name and phone count as recipient contact.');
assert(!hasRecipientContact({ ...base, recipientName: '   ' }), 'Blank recipient name is blocked.');
assert(!hasRecipientContact({ ...base, recipientPhone: '' }), 'Blank recipient phone is blocked.');
assert(isValidPhone('(407) 555-0199'), 'Formatted 10-digit phone is valid.');
assert(!isValidPhone('555-0199'), 'Short phone is blocked.');
assert(!isValidPhone('abcdefghij'), 'Non-numeric phone is blocked.');
assert(isValidZip('34711') && isValidZip('34711-1234'), '5-digit and ZIP+4 are valid.');
assert(!isValidZip('3471') && !isValidZip(''), 'Short or empty ZIP is blocked.');
assert(!hasDeliveryAddress(base), 'Pickup can leave street, city, state, and ZIP blank.');
assert(hasDeliveryAddress({
  ...base,
  recipientAddress: '1 Main',
  recipientCity: 'Orlando',
  recipientState: 'FL',
  recipientZip: '34711',
}), 'Delivery still requires the full address.');

const today = todayIsoDate();
const yesterday = todayIsoDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
assert(!isPastFulfillmentDate(today), 'Today is not a past date.');
assert(isPastFulfillmentDate(yesterday), 'Yesterday is blocked.');
assert(!isPastFulfillmentDate(''), 'Empty date is not treated as past (it is missing).');

const juliet = { subtotal: 125, taxableSubtotal: 125, recipientState: 'FL' };
const before = quoteCheckout({ ...juliet, deliveryType: '' });
assert(!before.deliveryChosen && before.deliveryFee === 0 && before.taxes === 0 && before.total === 125,
  'Before a method is chosen, delivery is not baked into the total.');

const configuredStudio = SITE_CONFIG.addressState;
SITE_CONFIG.addressState = '';
const pickupUnset = quoteCheckout({ ...juliet, deliveryType: 'pickup' });
assert(pickupUnset.deliveryFee === 0 && pickupUnset.taxes === 0 && pickupUnset.total === 125,
  'Pickup does not charge delivery or destination tax when the studio state is unset.');
SITE_CONFIG.addressState = configuredStudio;
const pickup = quoteCheckout({ ...juliet, deliveryType: 'pickup' });
assert(pickup.deliveryFee === 0 && pickup.taxes === 125 * 0.06 && pickup.total === 125 + 125 * 0.06,
  'Pickup tax follows the live studio state (FL), not a delivery fee.');

const previousStudio = SITE_CONFIG.addressState;
SITE_CONFIG.addressState = 'FL';
const pickupAtStudio = quoteCheckout({ ...juliet, recipientState: 'NY', deliveryType: 'pickup' });
assert(pickupAtStudio.taxes === 125 * 0.06 && pickupAtStudio.deliveryFee === 0,
  'Pickup tax follows the studio state, not the recipient delivery state.');
SITE_CONFIG.addressState = previousStudio;

const delivery = quoteCheckout({ ...juliet, deliveryType: 'standard' });
assert(delivery.deliveryFee === 9.99 && delivery.taxes === 125 * 0.06 && delivery.total === 125 + 9.99 + 125 * 0.06,
  'FL delivery charges the $9.99 fee and taxes the goods only.');

const ny = quoteCheckout({ ...juliet, recipientState: 'NY', deliveryType: 'standard' });
assert(ny.taxes === (125 + 9.99) * 0.04, 'NY delivery tax includes the delivery fee.');

const sameDay = quoteCheckout({ ...juliet, deliveryType: 'sameday' });
assert(sameDay.deliveryFee === 19.99, 'Same-day fee stays $19.99.');

const stepForm = {
  recipientName: 'Jordan Recipient',
  recipientPhone: '555-0100',
  recipientAddress: '',
  recipientCity: '',
  recipientState: '',
  recipientZip: '',
  deliveryType: '',
  deliveryDate: today,
  senderName: 'Alex Sender',
  senderEmail: 'alex@example.com',
};
const shortPhone = validateCheckoutStep(1, stepForm);
assert(shortPhone?.issue === 'phone' && shortPhone.step === 1,
  'Recipient Continue blocks a short phone and does not mention ZIP.');
const blankAddress = validateCheckoutStep(1, { ...stepForm, recipientPhone: '(407) 555-0199' });
assert(blankAddress === null, 'Recipient Continue allows a blank address and ZIP when the phone has 10 digits.');
const pickupOk = validateCheckoutStep(2, {
  ...stepForm,
  recipientPhone: '(407) 555-0199',
  deliveryType: 'pickup',
});
assert(pickupOk === null, 'In-store pickup does not require a delivery address or ZIP.');
const deliveryNeedsAddress = validateCheckoutStep(2, {
  ...stepForm,
  recipientPhone: '(407) 555-0199',
  deliveryType: 'standard',
});
assert(deliveryNeedsAddress?.issue === 'address' && deliveryNeedsAddress.step === 1,
  'Standard delivery requires a complete address before continuing.');
const sameDayNeedsZip = validateCheckoutStep(2, {
  ...stepForm,
  recipientPhone: '(407) 555-0199',
  recipientAddress: '1 Main',
  recipientCity: 'Miami',
  recipientState: 'FL',
  recipientZip: '331',
  deliveryType: 'sameday',
});
assert(sameDayNeedsZip?.issue === 'address', 'Same-day delivery rejects an invalid ZIP without a phone combo error.');
const deliveryOk = validateCheckoutStep(2, {
  ...stepForm,
  recipientPhone: '(407) 555-0199',
  recipientAddress: '1 Main',
  recipientCity: 'Miami',
  recipientState: 'FL',
  recipientZip: '33101',
  deliveryType: 'standard',
});
assert(deliveryOk === null, 'A complete delivery address passes the delivery step.');

const atStudio = 'Pickup at studio';
const emailLine = "We'll email pickup instructions with your confirmation.";
const emptyPickup = studioPickupBodyLines(atStudio, emailLine);
assert(JSON.stringify(emptyPickup) === JSON.stringify([
  `${SITE_CONFIG.businessName} — ${atStudio}`,
  emailLine,
]), 'Empty studio street renders the trading name and email instructions only.');
assert(emptyPickup.every((line) => line.trim().length > 0), 'Empty studio street never leaves a blank line.');
assert(!emptyPickup.some((line) => /downtown|TBD|street/i.test(line)), 'Empty studio copy does not invent a street or downtown claim.');

const savedAddress = {
  addressLine1: SITE_CONFIG.addressLine1,
  addressCity: SITE_CONFIG.addressCity,
  addressState: SITE_CONFIG.addressState,
  addressZip: SITE_CONFIG.addressZip,
};
SITE_CONFIG.addressCity = 'Orlando';
SITE_CONFIG.addressState = 'FL';
SITE_CONFIG.addressZip = '34711';
const cityOnly = studioPickupBodyLines(atStudio, emailLine);
assert(JSON.stringify(cityOnly) === JSON.stringify(emptyPickup),
  'City without a street stays on the name/studio path and hides the fragment.');
SITE_CONFIG.addressLine1 = '100 Bloom Way';
const withStreet = studioPickupBodyLines(atStudio, emailLine);
assert(withStreet[0] === `${SITE_CONFIG.businessName} — ${atStudio}`, 'A configured street keeps the studio title.');
assert(withStreet[1] === '100 Bloom Way', 'A configured street is shown on its own line.');
assert(withStreet[2] === 'Orlando, FL 34711', 'City, state, and ZIP follow the street.');
assert(!withStreet.includes(emailLine), 'A configured street replaces the email-only fallback.');
SITE_CONFIG.addressLine1 = savedAddress.addressLine1;
SITE_CONFIG.addressCity = savedAddress.addressCity;
SITE_CONFIG.addressState = savedAddress.addressState;
SITE_CONFIG.addressZip = savedAddress.addressZip;

const delivered = deliveryDestinationLines({
  fullName: 'Jordan Recipient',
  street: '1 Main St',
  city: 'Miami',
  state: 'FL',
  zip: '33101',
  deliverTo: 'Deliver to Jordan Recipient',
});
assert(JSON.stringify(delivered) === JSON.stringify([
  'Deliver to Jordan Recipient',
  '1 Main St',
  'Miami, FL 33101',
]), 'Delivery confirmation shows the recipient, street, and locality.');
const noStreet = deliveryDestinationLines({
  fullName: 'Jordan Recipient',
  street: '',
  city: 'Miami',
  state: 'FL',
  zip: '',
  deliverTo: 'Deliver to Jordan Recipient',
});
assert(JSON.stringify(noStreet) === JSON.stringify(['Deliver to Jordan Recipient', 'Miami, FL']),
  'A missing street is omitted rather than labeled as a home.');
const joined = [...emptyPickup, ...delivered, ...noStreet].join(' ');
assert(!joined.includes("'s home") && !joined.includes('Delivery Residence'),
  'Confirmation lines never use Name\'s home or Delivery Residence.');

if (failed > 0) {
  console.error(`❌ ${failed} checkout minor check(s) failed.`);
  process.exit(1);
}
console.log('✅ Checkout minor checks passed.');
