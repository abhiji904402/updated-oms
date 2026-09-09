// Just testing if git status has the files modified.
const { execSync } = require('child_process');
console.log(execSync('git status').toString());
