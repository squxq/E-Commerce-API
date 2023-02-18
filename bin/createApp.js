#!/usr/bin/env node
const util = require("util");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

// Utility functions
const exec = util.promisify(require("child_process").exec);
async function runCmd(command) {
  try {
    const { stdout, stderr } = await exec(command);
    console.log(stdout);
    console.log(stderr);
  } catch {
    (err) => {
      console.log(err);
    };
  }
}

async function hasYarn() {
  try {
    await execSync("yarnpkg --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Validate Arguments
if (process.argv.length < 3) {
  console.log("Please specify the target project directory.");
  console.log("For example:");
  console.log("    npx create-nodejs-app e-commerce-api");
  console.log("    OR");
  console.log("    npm init nodejs-app e-commerce-api");
  process.exit(1);
}

// Define Constants
const ownPath = process.cwd();
const folderName = process.argv[2];
const appPath = path.join(ownPath, folderName);
const repo = "https://github.com/squxq/E-Commerce-API.git";

// Check if directory already exists
try {
  fs.mkdirSync(appPath);
} catch (err) {
  if (err.code === "EEXIST") {
    console.log("Directory already exists. Please choose another name for the project.");
  } else {
    console.log(err);
  }
  process.exit(1);
}

async function setup() {
  try {
    // Clone repo
    console.log(`Downloading files from repo ${repo}`);
    await runCmd(`git clone --depth 1 ${repo} ${folderName}`);
    console.log("Cloned successfully.");
    console.log("");

    // Change directory
    process.chdir(appPath);

    // install dependencies
    const useYarn = await hasYarn();
    console.log("Installing dependencies...");
    if (useYarn) {
      await runCmd("yarn install");
    } else {
      await runCmd("npm install");
    }
    console.log("Dependencies installed successfully.");
    console.log("");

    // Copy environment variables
    fs.copyFileSync(path.join(appPath, ".env.example"), path.join(appPath, ".env"));
    console.log("Environment files copied.");

    // Delete .git folder
    await runCmd("npx rimraf ./.git");

    // Remove extra files
    fs.unlinkSync(path.join(appPath, "CHANGELOG.md"));
    fs.unlinkSync(path.join(appPath, "CODE_OF_CONDUCT.md"));
    fs.unlinkSync(path.join(appPath, "CONTRIBUTING.md"));
    fs.unlinkSync(path.join(appPath, "bin", "createNodejsApp.js"));
    fs.rmdirSync(path.join(appPath, "bin"));

    if (!useYarn) {
      fs.unlinkSync(path.join(appPath, "yarn.lock"));
    }

    console.log("Installation is now complete!");
    console.log();

    console.log("We suggest that you start by typing:");
    console.log(`    cd ${folderName}`);
    console.log(useYarn ? "    yarn dev" : "    npm run dev");
    console.log();
    console.log("Enjoy your production-ready E-Commerce-API, which already supports a large number of ready-made features!");
    console.log("Check README.md for more info.");
  } catch (err) {
    console.log(err);
  }
}

setup();
