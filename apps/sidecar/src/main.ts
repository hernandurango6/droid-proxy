import { SidecarOrchestrator } from "./orchestrator";

async function main(): Promise<void> {
  const orchestrator = new SidecarOrchestrator({ moduleDirname: __dirname });
  await orchestrator.start();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});