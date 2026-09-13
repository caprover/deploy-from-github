function escapeCommandData(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

export function getInput(name: string): string {
  const key = `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
  return process.env[key] || "";
}

export function setSecret(value: string): void {
  process.stdout.write(`::add-mask::${escapeCommandData(value)}\n`);
}

export function info(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function setFailed(message: string): void {
  process.stderr.write(`::error::${escapeCommandData(message)}\n`);
  process.exitCode = 1;
}
