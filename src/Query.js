const _ = require("lodash");
const DEBUG = process.env.DEBUG || 1;

// Chain operations on find() and findByID
module.exports = class Query {
  constructor(model, params, byID, _knex) {
    this.knex = _knex;
    this.model = model;
    this.schema = model.schema; // sugar
    this.params = params; // || {};
    this.populateFields = [];
    //this.ops = [ SQLZ_INCLUDE_ALL ]; // include all?
    this.byID = byID === true;//? "findByID" : "findAll";
  }
  sort(field) {
    this.ops.push({ order: [ [ field, "DESC" ] ] });
  }
  populate(model1, model2) {
   // TODO: POPULATE
   if(model1) this.populateFields.push(model1);
   if(model2) this.populateFields.push(model2);
  }
  exec(cb) {
    //this.params = _.merge(this.params, ...ops);
    if (DEBUG) console.log("exec", this.method);
    const _schema = this.schema;
    console.log('_schema.table', _schema.table);

    let q = this.knex.select('*').from(_schema.table);
    if(this.byID) q = q.where('_id', this.params);

    // TODO
    _.forEach(this.populateFields, f => {
      const schema = this.schema;
      const models = _.filter(this.schema.joins, (v,k) => {
        return v.refTable === f; // TODO match PG table name
      })
      console.log('todo bind ', f);
    });
       

    return q.then(x=>cb(null, x));     
    //this.model[this.method](this.params).then(x => cb(null, x)).catch(cb);
  }
};

