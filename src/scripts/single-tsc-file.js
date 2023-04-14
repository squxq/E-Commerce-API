const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

// define the desirec inclue property

const include = process.argv[2] || "src/**/*.ts";
const outDirectory = process.argv[3] || "dist/";

// Create a temporary `tsconfig.json` file that extends the existing config and sets `include`
const tempConfigPath = path.join(__dirname, "../../temp-tsconfig.json");
const existingConfigPath = path.join(__dirname, "../../tsconfig.json");
const tempConfig = {
  extends: existingConfigPath,
  include: [include],
  compilerOptions: {
    outDir: outDirectory,
  },
};

fs.writeFileSync(tempConfigPath, JSON.stringify(tempConfig));

// Call `tsc` with the `--project` flag set to the temporary `tsconfig.json` file
childProcess.execSync(`tsc --project ${tempConfigPath}`, { stdio: "inherit" });

// Delete the temporary `tsconfig.json` file
fs.unlinkSync(tempConfigPath);
