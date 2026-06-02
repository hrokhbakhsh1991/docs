/**
 * Finance-facing registration ports without Outbox/Payments/Tours module imports.
 */
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserEntity } from "../identity/entities/user.entity";
import { REGISTRATION_FINANCIAL_MUTATION_PORT } from "../../common/ports/registration-financial-mutation.port";
import { FINANCE_RECEIPT_ACTOR_PORT } from "../../common/ports/finance-receipt-actor.port";
import { RECONCILIATION_REGISTRATION_READ_PORT } from "../../common/ports/reconciliation-registration-read.port";
import { RegistrationEntity } from "./registration.entity";
import {
  FinanceReceiptActorAdapter,
  ReconciliationRegistrationReadAdapter,
  RegistrationFinancialMutationAdapter,
} from "./repositories/registration-finance-port.adapters";

@Module({
  imports: [TypeOrmModule.forFeature([RegistrationEntity, UserEntity])],
  providers: [
    RegistrationFinancialMutationAdapter,
    {
      provide: REGISTRATION_FINANCIAL_MUTATION_PORT,
      useClass: RegistrationFinancialMutationAdapter,
    },
    FinanceReceiptActorAdapter,
    {
      provide: FINANCE_RECEIPT_ACTOR_PORT,
      useClass: FinanceReceiptActorAdapter,
    },
    ReconciliationRegistrationReadAdapter,
    {
      provide: RECONCILIATION_REGISTRATION_READ_PORT,
      useClass: ReconciliationRegistrationReadAdapter,
    },
  ],
  exports: [
    REGISTRATION_FINANCIAL_MUTATION_PORT,
    FINANCE_RECEIPT_ACTOR_PORT,
    RECONCILIATION_REGISTRATION_READ_PORT,
  ],
})
export class RegistrationFinancePortsModule {}
