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
} from './src/services/checkoutValidation.ts';
import { SITE_CONFIG } from './src/config/siteConfig.ts';

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

const pickup = quoteCheckout({ ...juliet, deliveryType: 'pickup' });
assert(pickup.deliveryFee === 0 && pickup.taxes === 0 && pickup.total === 125,
  'Pickup does not charge delivery or the recipient FL tax when the studio state is unset.');

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

if (failed > 0) {
  console.error(`❌ ${failed} checkout minor check(s) failed.`);
  process.exit(1);
}
console.log('✅ Checkout minor checks passed.');
