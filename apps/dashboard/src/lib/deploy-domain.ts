/** Default root domain for user-published sites ({slug}.drooper.xyz). */
export const DEFAULT_DEPLOY_BASE_DOMAIN = 'drooper.xyz';

export function getDeployBaseDomain(): string {
  const fromEnv = process.env.NEXT_PUBLIC_DEPLOY_BASE_DOMAIN?.trim();
  return fromEnv || DEFAULT_DEPLOY_BASE_DOMAIN;
}
