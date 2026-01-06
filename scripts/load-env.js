/**
 * Custom environment loader that prioritizes system environment variables
 * over .env file values. This ensures that injected variables are not overridden
 * by placeholder values in .env
 */
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const lines = envContent.split(/\r?\n/);

  lines.forEach((line) => {
    if (!line) return;
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) return;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) return;

    const key = match[1].trim();
    let value = match[2].trim();

    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Only set if not already defined in environment
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  });
}

module.exports = {};
