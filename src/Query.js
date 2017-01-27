const _ = require("lodash");
const DEBUG = process.env.DEBUG || 1;

// Chain operations on find() and findByID
module.exports = class Query {
  constructor(model, params, byID, _knex) {
    this.knex = _knex;
    this.model = model;
    this.params = params || {};
    //this.ops = [ SQLZ_INCLUDE_ALL ]; // include all?
    this.method = byID === true;//? "findByID" : "findAll";
  }
  sort(field) {
    this.ops.push({ order: [ [ field, "DESC" ] ] });
  }
  exec(cb) {
    //this.params = _.merge(this.params, ...ops);
    if (DEBUG) console.log("exec", this.method);
    const _schema = this.model.schema;
    console.log('_schema.table', _schema.table);
    return this.knex.select('*').from(_schema.table)
      .then(x=>cb(null, x));
    //this.model[this.method](this.params).then(x => cb(null, x)).catch(cb);
  }
};
// TODO: POPULATE
