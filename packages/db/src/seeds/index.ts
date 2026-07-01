export type SeedContext = {
  initializedAt: string;
};

export async function runSeed(context: SeedContext): Promise<SeedContext> {
  return context;
}
