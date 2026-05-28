import type { EntityManager } from "typeorm";
import { RegistrationEntity } from "../../src/modules/registrations/registration.entity";
import type {
  IRegistrationsReadRepository,
  RegistrationReadWhere
} from "../../src/modules/registrations/repositories/registrations-read.repository.interface";

type RepoLike = {
  findOne(_opts: { where: RegistrationReadWhere }): Promise<RegistrationEntity | null>;
};

/**
 * Test double for {@link IRegistrationsReadRepository}: delegates `findOneStandalone` to a
 * repository-shaped mock and `findOneInManager` to `manager.findOne(RegistrationEntity, …)`.
 */
export function createRegistrationsReadRepositoryTestDouble(
  registrationRepository: RepoLike
): IRegistrationsReadRepository {
  return {
    findOneStandalone(where) {
      return registrationRepository.findOne({ where });
    },
    findOneInManager(manager: EntityManager, where) {
      return manager.findOne(RegistrationEntity, { where });
    }
  };
}

/** Use when tests only hit transactional reads (`findOneInManager`). */
export function createNullStandaloneRegistrationsReadTestDouble(): IRegistrationsReadRepository {
  return createRegistrationsReadRepositoryTestDouble({
    async findOne() {
      return null;
    }
  });
}
