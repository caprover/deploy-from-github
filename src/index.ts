import { deploy } from "./deploy.js";
import { info, setFailed } from "./github.js";
import { getInputs } from "./inputs.js";

export async function run(): Promise<void> {
  try {
    await deploy(getInputs());
    info("Deployment accepted by CapRover");
  } catch (error) {
    setFailed(error instanceof Error ? error.message : String(error));
  }
}

if (process.env.NODE_ENV !== "test") {
  void run();
}
