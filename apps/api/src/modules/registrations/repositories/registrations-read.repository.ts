import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager } from "typeorm";
import { Repository } from "typeorm";
import { RegistrationEntity } from "../registration.entity";
import type {
  IRegistrationsReadRepository,
  RegistrationReadWhere
} from "./registrations-read.repository.interface";

@Injectable()
export class RegistrationsReadRepository implements IRegistrationsReadRepository {
  constructor(
    @InjectRepository(RegistrationEntity)
    private readonly registrations: Repository<RegistrationEntity>
  ) {}

  findOneStandalone(where: RegistrationReadWhere): Promise<RegistrationEntity | null> {
    return this.registrations.findOne({ where });
  }

  findOneInManager(
    manager: EntityManager,
    where: RegistrationReadWhere
  ): Promise<RegistrationEntity | null> {
    return manager.findOne(RegistrationEntity, { where });
  }
}
