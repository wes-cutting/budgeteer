import { type NameValidation, validateName } from "./naming";

export const ENVELOPE_KINDS = ["standard", "sinking_fund"] as const;
export type EnvelopeKind = (typeof ENVELOPE_KINDS)[number];

export function isEnvelopeKind(x: string): x is EnvelopeKind {
  return (ENVELOPE_KINDS as readonly string[]).includes(x);
}

export interface Envelope {
  readonly id: string;
  readonly householdId: string;
  readonly name: string;
  readonly kind: EnvelopeKind;
  readonly createdAt: Date;
  readonly archivedAt: Date | null;
}

export function validateEnvelopeName(raw: string): NameValidation {
  return validateName(raw, "Envelope");
}

/** Archived envelopes keep their history but accept no new allocations (domain rule). */
export function canReceiveAllocations(envelope: Pick<Envelope, "archivedAt">): boolean {
  return envelope.archivedAt === null;
}
