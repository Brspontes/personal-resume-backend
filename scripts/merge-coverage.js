const fs = require('fs');
const path = require('path');
const libCoverage = require('istanbul-lib-coverage');
const libReport = require('istanbul-lib-report');
const reports = require('istanbul-reports');

const coverageDir = path.join(__dirname, '..', 'coverage');
const sources = ['unit', 'e2e'].map((name) =>
  path.join(coverageDir, name, 'coverage-final.json'),
);

const map = libCoverage.createCoverageMap({});
for (const file of sources) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  map.merge(data);
}

const mergedDir = path.join(coverageDir, 'merged');
fs.mkdirSync(mergedDir, { recursive: true });

const context = libReport.createContext({
  dir: mergedDir,
  coverageMap: map,
});

reports.create('text-summary').execute(context);
reports.create('text').execute(context);
reports.create('json-summary', { file: 'coverage-summary.json' }).execute(context);
