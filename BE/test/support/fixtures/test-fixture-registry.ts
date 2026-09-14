export interface TestFixtureRegistry {
  reset(): Promise<void>;
}

export class NoopFixtureRegistry implements TestFixtureRegistry {
  async reset(): Promise<void> {
    return Promise.resolve();
  }
}
