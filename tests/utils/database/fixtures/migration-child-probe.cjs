const fs = require("node:fs");
const net = require("node:net");
const pg = require("pg");

let fixtureRead = false;
const readFileSync = fs.readFileSync;
fs.readFileSync = function (path, ...args) {
  if (String(path) === process.env.MIGRATION_PROBE_ENV_PATH) {
    fixtureRead = true;
  }
  return readFileSync.call(this, path, ...args);
};

// Run the real CLI configuration path, then stop before any connection or query.
net.Socket.prototype.connect = () => {
  throw new Error("Migration probe must not open a network connection");
};
pg.Client.prototype.connect = function () {
  const target = this.connectionParameters;
  const actual = {
    fixtureRead,
    targetPreserved:
      target.host === process.env.MIGRATION_PROBE_EXPECTED_HOST &&
      target.database === process.env.MIGRATION_PROBE_EXPECTED_DATABASE,
    optionsAbsent: !target.options && !process.env.PGOPTIONS,
    dotenvControlsAbsent: !Object.keys(process.env).some((key) =>
      key.startsWith("DOTENV_"),
    ),
  };
  process.stdout.write(`MIGRATION_PROBE:${JSON.stringify(actual)}\n`);
  process.exit(0);
};
