/* eslint-env node */
/* This is a test harness for repeating the test suite many times
 * in order to determine which tests are inconsistent and fail then
 * most.
 */
const os = require("os");
const fs = require("fs");
const { spawn } = require("child_process");

// Promise wrapper around childProcess.spawn()
function spawnProcess(command, args) {
  return new Promise((resolve, reject) => {
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
      resolve({ code, stdoutArray, stderrArray });
    });
  });
}

async function main() {
  const childProcesses = [];
  // TODO Use a "process pool"
  for (let i = 0; i < os.cpus().length; i++) {
    childProcesses.push(spawnProcess("npm", ["run", "--silent", "test", "--", "--reporter", "json"]));
    // childProcesses.push(spawnProcess("mocha", ["fake_test.js", "--reporter", "json"]));
    // childProcesses.push(spawnProcess("npm", ["t", "--", "--grep",
    //  "should have a share button", "--reporter", "json"]));
  }

  // TODO Promise.all() will reject upon a single error, is this an issue?
  try {
    const resolvedChildProcesses = await Promise.all(childProcesses);
    const failedTestCounts = {};
    for (const resolvedChildProcess of resolvedChildProcesses) {
      // FIXME: extract only JSON test output
      const rawOutput = resolvedChildProcess.stdoutArray;
      try {
        const mochaOutput = JSON.parse(rawOutput.join(""));
        for (const failedTest of mochaOutput.failures) {
          if (!(failedTest.fullTitle in failedTestCounts)) {
            failedTestCounts[failedTest.fullTitle] = 0;
          }
          failedTestCounts[failedTest.fullTitle] += 1;
        }
      } catch (e) {
        console.log(`JSON parsing error: ${e}`);
        console.log(rawOutput);
      }
    }
    console.log(failedTestCounts);
    fs.writeFile(`test_harness_output_${new Date().toISOString()}.txt`, JSON.stringify(failedTestCounts),
      (err) => {
        if (err) {
          console.log(`fs.writeFile errror: ${err}`);
        }
      });
  } catch (e) {
    console.log(`One of the childProcesses failed ${e}.`);
  }
}

if (require.main === module) {
  main();
}
