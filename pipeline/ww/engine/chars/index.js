'use strict';
// Node entry: registers every character module with the engine. Returns the engine.
const WW = require('../ww_engine.js');
const fs = require('fs');
const path = require('path');
for (const f of fs.readdirSync(__dirname).filter((x) => /^\d+_.*\.js$/.test(x)).sort()) require(path.join(__dirname, f));
module.exports = WW;
