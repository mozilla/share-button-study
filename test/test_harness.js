/* eslint-env node */
/* eslint no-console: "off" */

/* This is a test harness for repeating the test suite many times
 * in order to determine which tests are inconsistent and fail then
 * most.
 */
const os = require("os");
const fs = require("fs");
const { spawn } = require("child_process");

// Promise wrapper around childProcess.spawn()
function spawnProcess(command, args) {
  return new Promise((resolve) => {
    const childProcess = spawn(command, args);
    const stderrArray = [];
    const stdoutArray = [];

    childProcess.stdout.on("data", (data) => {
      stdoutArray.push(data.toString()); // data is of type Buffer
    });

    childProcess.stderr.on("data", (data) => {
      // TODO reject upon error?
      stderrArray.push(data.toString()); // data is of type Buffer
    });

    childProcess.on("close", (code) => {
      // TODO reject upon error?
      console.log("Test suite completed.");
      resolve({ code, stdoutArray, stderrArray });
    });
  });
}

async function main() {
  const failedTestCounts = new Map();

  for (let i = 0; i < 4; i++) {
    console.log(`Currently running test suite #${i}.`);
    const childProcesses = [];
    // TODO Use a "process pool"?
    // Right now, there are unused resources when a test finishes and we are waiting
    // for all 8 tests to finish before spawning a new test
    for (let j = 0; j < os.cpus().length; j++) {
      childProcesses.push(spawnProcess("npm", ["run", "--silent", "test", "--", "--reporter", "json"]));
      // childProcesses.push(spawnProcess("mocha", ["fake_test.js", "--reporter", "json"]));
      // childProcesses.push(spawnProcess("npm", ["t", "--", "--grep",
      //  "should have a share button", "--reporter", "json"]));
    }

    // TODO Promise.all() will reject upon a single error, is this an issue?
    try {
      // eslint-disable-next-line no-await-in-loop
      const resolvedChildProcesses = await Promise.all(childProcesses);
      for (const resolvedChildProcess of resolvedChildProcesses) {
        // FIXME: extract only JSON test output
        const rawOutput = resolvedChildProcess.stdoutArray;
        try {
          const mochaOutput = JSON.parse(rawOutput.join(""));
          for (const failedTest of mochaOutput.failures) {
            if (!(failedTestCounts.has(failedTest.fullTitle))) {
              failedTestCounts.set(failedTest.fullTitle, 0);
            }
            failedTestCounts.set(failedTest.fullTitle,
              failedTestCounts.get(failedTest.fullTitle) + 1);
          }
        } catch (e) {
          console.log(`JSON parsing error: ${e}`);
          console.log(rawOutput);
        }
      }
    } catch (e) {
      console.log(`One of the childProcesses failed ${e}.`);
    }
  }
  console.log(failedTestCounts);
  for (const pair of failedTestCounts) {
    fs.appendFile(`test_harness_output_${new Date().toISOString()}.txt`, `${pair[0]}: ${pair[1]}\n`,
      (err) => {
        if (err) {
          console.log(`fs.writeFile errror: ${err}`);
        }
      });
  }
}

if (require.main === module) {
  main();
}
