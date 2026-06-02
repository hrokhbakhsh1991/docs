export class GetRegistrationDetailQuery {
  constructor(
    public readonly registrationId: string,
    public readonly tenantId: string
  ) {}
}
