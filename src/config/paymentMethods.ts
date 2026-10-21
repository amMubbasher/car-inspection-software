// Edit paymentMethods.json to add or remove options. Each `value` is what gets stored
// on the job, so rename a label freely but keep existing values stable.
import options from "./paymentMethods.json";

export type PaymentMethodOption = { value: string; label: string };

export const PAYMENT_METHODS: readonly PaymentMethodOption[] = options;

export const PAYMENT_METHOD_VALUES = PAYMENT_METHODS.map((option) => option.value);

/** Label for a stored value. Falls back to the raw value if the option was removed later. */
export function paymentMethodLabel(value: string | null | undefined) {
  if (!value) return "";
  return PAYMENT_METHODS.find((option) => option.value === value)?.label ?? value;
}

/** The payment method is optional, but required once the job has a price. */
export function needsPaymentMethod(price: number | null | undefined) {
  return (Number(price) || 0) > 0;
}
