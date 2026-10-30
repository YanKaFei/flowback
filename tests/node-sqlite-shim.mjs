import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const mod = require("node:sqlite");

export const DatabaseSync = mod.DatabaseSync;
export default mod;
