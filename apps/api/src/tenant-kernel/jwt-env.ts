export type JwtVerifyConfig = {
  readonly publicKeyPem: string;
  readonly issuer: string;
  readonly audience: string;
};

export function readJwtVerifyConfig(): JwtVerifyConfig | null {
  const publicKeyPem = process.env.AUTH_JWT_PUBLIC_KEY?.trim();
  if (publicKeyPem === undefined || publicKeyPem.length === 0) {
    return null;
  }
  const issuer = process.env.AUTH_JWT_ISSUER?.trim();
  const audience = process.env.AUTH_JWT_AUDIENCE?.trim();
  if (issuer === undefined || issuer.length === 0 || audience === undefined || audience.length === 0) {
    return null;
  }
  return { publicKeyPem, issuer, audience };
}

export function isJwtVerifyConfigured(): boolean {
  return readJwtVerifyConfig() !== null;
}
