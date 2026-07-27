/**
 * errors — the accounting engine's domain-error base.
 *
 * kasir already has ONE error pipeline (`lib/action-error.ts`: ActionError +
 * runAction + the Zod/Prisma mappers). This module does NOT introduce a second
 * one — `DomainError` extends `ActionError` so every accounting error flows
 * through the existing `runAction` seam and renders in the UI unchanged.
 *
 * The inversion rule the engine relies on: a domain error's message is safe to
 * show the user, so repositories write them in Indonesian sentence case — the
 * message IS the user copy. Never wrap or translate it at the action layer.
 *
 * Errors that are BUGS rather than user mistakes (UnbalancedEntryError,
 * IllegalStateTransitionError, EntryNotFoundError) deliberately extend plain
 * `Error`, not this — they must never leak their message to a user.
 *
 * This file exists as a thin seam so donor files copied from tokokencana can
 * keep their `from "../errors"` import unchanged.
 */

import { ActionError } from "@/lib/action-error";

export class DomainError extends ActionError {
  constructor(message: string) {
    super(message, "DOMAIN_ERROR");
    // Preserve the concrete subclass name (PeriodLockedError, etc.) rather
    // than ActionError's hardcoded "ActionError".
    this.name = new.target.name;
  }
}
