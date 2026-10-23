// VAT helpers shared by the API, the receipt and the UI.
import type { VatSnapshot } from "@/types/job";

export type SafeVat = VatSnapshot & {
  _id: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type RawVat = {
  _id: { toString(): string };
  name: string;
  registrationNumber: string;
  percentage: number;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export function toSafeVat(vat: RawVat): SafeVat {
  return {
    _id: vat._id.toString(),
    name: vat.name,
    registrationNumber: vat.registrationNumber,
    percentage: vat.percentage,
    isActive: Boolean(vat.isActive),
    createdAt: vat.createdAt?.toISOString(),
    updatedAt: vat.updatedAt?.toISOString(),
  };
}

export function toVatSnapshot(vat: RawVat | null | undefined): VatSnapshot | null {
  if (!vat) return null;
  return {
    name: vat.name,
    registrationNumber: vat.registrationNumber,
    percentage: vat.percentage,
  };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Splits a VAT-inclusive total into its net amount and VAT. */
export function splitVatInclusive(total: number, percentage: number) {
  const gross = Math.max(0, Number(total) || 0);
  const rate = Math.max(0, Number(percentage) || 0);
  const vatAmount = round2((gross * rate) / (100 + rate));
  return { total: round2(gross), net: round2(gross - vatAmount), vatAmount };
}
