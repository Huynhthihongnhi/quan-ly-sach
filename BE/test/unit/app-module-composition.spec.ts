async function withNodeEnv(value: string, run: () => Promise<void>): Promise<void> {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = value;
  try {
    await run();
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous;
    }
  }
}

describe('AppModule composition', () => {
  it('excludes ContractDemoModule when NODE_ENV=production, so demo routes are not live in a real deployment', async () => {
    await withNodeEnv('production', async () => {
      jest.resetModules();
      const { AppModule } = await import('../../src/app.module');
      const { ContractDemoModule } = await import(
        '../../src/modules/contract-demo/contract-demo.module'
      );
      const imports = Reflect.getMetadata('imports', AppModule) as unknown[];
      expect(imports).not.toContain(ContractDemoModule);
    });
  });

  it('includes ContractDemoModule outside production, so test/contract/http-contract.spec.ts keeps working', async () => {
    await withNodeEnv('test', async () => {
      jest.resetModules();
      const { AppModule } = await import('../../src/app.module');
      const { ContractDemoModule } = await import(
        '../../src/modules/contract-demo/contract-demo.module'
      );
      const imports = Reflect.getMetadata('imports', AppModule) as unknown[];
      expect(imports).toContain(ContractDemoModule);
    });
  });
});
