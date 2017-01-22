const _ = require("lodash");
const DEBUG = process.env.DEBUG || 1;

const SQLZ_INCLUDE_ALL = { include: [ { all: true } ] };
// Chain operations on find() and findByID
module.exports = class Query {
  constructor(model, params, byID) {
    this.model = model;
    this.params = params || {};
    this.ops = [ SQLZ_INCLUDE_ALL ];
    this.method = byID ? "findByID" : "findAll";
  }
  sort(field) {
    this.ops.push({ order: [ [ field, "DESC" ] ] });
  }
  exec(cb) {
    this.params = _.merge(this.params, ...ops);
    if (DEBUG) console.log("exec", this.method, this.params);
    this.model[this.method](this.params).then(x => cb(null, x)).catch(cb);
  }
}
