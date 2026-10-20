"use client";

import { PAYMENT_METHODS } from "@/config/paymentMethods";

/** Payment method dropdown. Options come from src/config/paymentMethods.json. */
export function PaymentMethodSelect({
  id,
  value,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      required
    >
      <option value="">Select Payment Method</option>
      {PAYMENT_METHODS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
