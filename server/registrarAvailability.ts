export interface RegistrarAvailabilityCheck {
  domain: string;
  purchasable: boolean | null;
  price: string | null;
  premium: boolean | null;
  restrictions: string[];
  source: string;
}

export interface RegistrarAvailabilityProvider {
  check(domain: string): Promise<RegistrarAvailabilityCheck>;
}

export const registrarAvailabilityProvider: RegistrarAvailabilityProvider | null = null;
