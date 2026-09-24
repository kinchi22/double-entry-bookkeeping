export type HealthProbe = {
  readonly name: string;
  check: () => Promise<boolean>;
};
