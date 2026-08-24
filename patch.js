const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');
code = code.replace(
`const filterData = (data: any, constraints: any[]) => {
  if (!constraints || constraints.length === 0) return true;
  for (const c of constraints) {
    const val = data[c.field];`,
`const filterData = (data: any, constraints: any[]) => {
  if (!data) return false;
  if (!constraints || constraints.length === 0) return true;
  for (const c of constraints) {
    const val = data[c.field];`
);
fs.writeFileSync('src/lib/firebase.ts', code);
