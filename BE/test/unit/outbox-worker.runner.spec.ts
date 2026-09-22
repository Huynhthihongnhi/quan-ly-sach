import { OutboxWorkerRunner } from '../../src/modules/messaging/outbox-worker.runner';

describe('OutboxWorkerRunner', () => {
  it('survives a transient error from one iteration instead of crashing the process', async () => {
    let scanCalls = 0;
    const scheduler = {
      scanDueReminders: jest.fn(() => {
        scanCalls += 1;
        if (scanCalls === 1) {
          throw new Error('Circulation schema is not available.');
        }
        return Promise.resolve(0);
      }),
    };

    const runner = new OutboxWorkerRunner(
      {
        runMaintenance: jest.fn().mockResolvedValue(undefined),
        processBatch: jest.fn().mockImplementation(() => {
          if (scanCalls >= 2) {
            runner.requestStop();
          }
          return Promise.resolve(1);
        }),
      } as never,
      { jobPollSeconds: 0 } as never,
      scheduler,
    );

    await expect(runner.runUntilStopped()).resolves.toBeUndefined();
    expect(scanCalls).toBeGreaterThanOrEqual(2);
  });

  it('floors the retry backoff at 1s even when JOB_POLL_SECONDS=0, so a persistent failure cannot spin the CPU', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    let failureCalls = 0;

    const runner = new OutboxWorkerRunner(
      {
        runMaintenance: jest.fn().mockImplementation(() => {
          failureCalls += 1;
          if (failureCalls >= 2) {
            runner.requestStop();
          }
          return Promise.reject(new Error('persistent failure'));
        }),
        processBatch: jest.fn().mockResolvedValue(0),
      } as never,
      { jobPollSeconds: 0 } as never,
    );

    await runner.runUntilStopped();

    const catchBranchDelays = setTimeoutSpy.mock.calls.map(([, delay]) => delay);
    expect(catchBranchDelays.every((delay) => (delay ?? 0) >= 1000)).toBe(true);
    setTimeoutSpy.mockRestore();
  });
});
