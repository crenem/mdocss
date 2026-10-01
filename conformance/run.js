import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";

const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, "..");
const cases = JSON.parse(await fs.readFile(path.join(here, "cases.json"), "utf8"));

function cli(args) {
  return spawnSync(process.execPath, [path.join(repo, "src", "cli.js"), ...args], {
    cwd: repo,
    encoding: "utf8"
  });
}

async function fixtureFor(testCase) {
  if (testCase.file) return path.join(here, "fixtures", testCase.file);

  const generated = testCase.generated;
  if (!generated || typeof generated !== "object") {
    throw new Error(`Conformance case ${testCase.id} has no file or generated fixture`);
  }

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mdocss-generated-"));
  const fixture = path.join(tmp, `${testCase.id}.mdocss`);

  if (generated.rawBase64) {
    await fs.writeFile(fixture, Buffer.from(generated.rawBase64, "base64"));
    return fixture;
  }

  const zip = new JSZip();
  zip.file("root.md", generated.root ?? "# Generated MDOCSS fixture\n");

  if (Object.prototype.hasOwnProperty.call(generated, "manifest")) {
    zip.file("manifest.json", JSON.stringify(generated.manifest, null, 2) + "\n");
  }

  for (const [name, content] of Object.entries(generated.files ?? {})) {
    zip.file(name, String(content));
  }

  await fs.writeFile(
    fixture,
    await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
  );

  return fixture;
}

async function checkRootRecovery(fixture) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mdocss-recovery-"));
  const unpacked = path.join(tmp, "unpacked");

  const result = cli(["unpack", fixture, unpacked]);
  if (result.status !== 0) {
    throw new Error(`safe recovery unpack failed: ${result.stderr || result.stdout}`);
  }

  const root = await fs.readFile(path.join(unpacked, "root.md"), "utf8");
  if (!root.trim()) throw new Error("recovered root.md was empty");
}

async function checkPreservation(fixture) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mdocss-conformance-"));
  const unpacked = path.join(tmp, "unpacked");
  const repacked = path.join(tmp, "repacked.mdocss");

  let result = cli(["unpack", fixture, unpacked]);
  if (result.status !== 0) throw new Error(`unpack failed: ${result.stderr || result.stdout}`);

  const manifest = JSON.parse(await fs.readFile(path.join(unpacked, "manifest.json"), "utf8"));
  if (manifest?.["x-example"]?.mode !== "preserve-me" || manifest?.["x-example"]?.number !== 42) {
    throw new Error("unknown manifest field was not preserved");
  }

  const vendor = await fs.readFile(path.join(unpacked, "extensions", "vendor.json"), "utf8");
  if (vendor !== '{"hello":"world"}\n') throw new Error("unknown archive member changed");

  result = cli(["pack", unpacked, repacked]);
  if (result.status !== 0) throw new Error(`repack failed: ${result.stderr || result.stdout}`);

  result = cli(["validate", repacked]);
  if (result.status !== 0) throw new Error(`repacked archive failed validation: ${result.stderr || result.stdout}`);
}

let failures = 0;

for (const testCase of cases) {
  const fixture = await fixtureFor(testCase);
  const validateArgs = ["validate", fixture];
  if (testCase.target) validateArgs.push("--target", testCase.target);
  const result = cli(validateArgs);
  const expectedStatus =
    testCase.expected === "valid"
      ? 0
      : testCase.expected === "unsupported"
        ? 2
        : 1;
  let ok = result.status === expectedStatus;
  let detail = "";

  if (ok && testCase.recoverRoot) {
    try {
      await checkRootRecovery(fixture);
    } catch (error) {
      ok = false;
      detail = error.message;
    }
  }

  if (ok && testCase.preservation) {
    try {
      await checkPreservation(fixture);
    } catch (error) {
      ok = false;
      detail = error.message;
    }
  }

  if (!ok) {
    failures += 1;
    if (!detail) {
      detail =
        (result.stderr || result.stdout || `validator exited ${result.status}; expected ${expectedStatus}`).trim();
    }
    console.error(
      `FAIL ${testCase.id} ${testCase.file ?? "[generated]"}: ${detail}`
    );
  } else {
    console.log(
      `PASS ${testCase.id} ${testCase.file ?? "[generated]"} (${testCase.expected})`
    );
  }
}

if (failures) {
  console.error(`\n${failures} conformance case(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nAll ${cases.length} MDOCSS conformance cases passed.`);
}
