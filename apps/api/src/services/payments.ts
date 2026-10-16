import { randomBytes } from 'node:crypto';
import type { PaymentOutcome } from '@amplify/domain';

/**
 * Payment provider boundary. The prototype ships a simulated provider; a real one
 * (e.g. Stripe in test mode) would implement the same interface.
 */
export interface ChargeResult {
  status: 'succeeded' | 'failed' | 'cancelled' | 'pending';
  providerRef: string;
  failureReason?: string;
  /** For pending charges: when the provider will report the final result. */
  settleAt?: Date;
  pendingOutcome?: 'succeeded' | 'failed';
}

export interface PaymentProvider {
  readonly name: string;
  charge(input: { amountCents: number; currency: 'usd'; outcome: PaymentOutcome }): Promise<ChargeResult>;
}

/** Simulated checkout — no money moves. The outcome is chosen explicitly in the demo checkout. */
export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = 'simulated';
  async charge({ outcome }: { amountCents: number; currency: 'usd'; outcome: PaymentOutcome }): Promise<ChargeResult> {
    await new Promise((r) => setTimeout(r, 700)); // feel like a real network round-trip
    const providerRef = 'sim_' + randomBytes(8).toString('hex');
    switch (outcome) {
      case 'succeed':
        return { status: 'succeeded', providerRef };
      case 'decline':
        return { status: 'failed', providerRef, failureReason: 'Your card was declined by the issuer (simulated).' };
      case 'cancel':
        return { status: 'cancelled', providerRef };
      case 'verify':
        return { status: 'pending', providerRef, settleAt: new Date(Date.now() + 4000), pendingOutcome: 'succeeded' };
    }
  }
}

export const payments: PaymentProvider = new SimulatedPaymentProvider();
