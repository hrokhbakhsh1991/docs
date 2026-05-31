import { Injectable } from "@nestjs/common";

/** In-process counters for public registration / waitlist / paid flows (observability). */
@Injectable()
export class RegistrationPublicFlowMetrics {
  registrationCreatedTotal = 0;
  registrationWaitlistedTotal = 0;
  registrationPaidTotal = 0;

  snapshot(): {
    registrationCreatedTotal: number;
    registrationWaitlistedTotal: number;
    registrationPaidTotal: number;
  } {
    return {
      registrationCreatedTotal: this.registrationCreatedTotal,
      registrationWaitlistedTotal: this.registrationWaitlistedTotal,
      registrationPaidTotal: this.registrationPaidTotal,
    };
  }
}
