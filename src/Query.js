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
    this.ops = [];
    this.byID = byID === true;//? "findByID" : "findAll";
  }
  sort(field) {
    // TODO: POPULATE
    this.ops.push(q => q.orderBy(field) ); //'desc'
    return this;
  }
  populate(model1, model2) {
   // TODO: POPULATE
   if(model1) this.populateFields.push(model1);
   if(model2) this.populateFields.push(model2);
   return this;
  }
  exec(cb) {
    // if (DEBUG) console.log("exec", this.method);
    const _schema = this.schema;

    let q = this.knex.select('*').from(_schema.table);
    if(this.byID) q = q.where('_id', this.params)
      .then(x => x.length > 0 ? x[0] : null);

    _.forEach(this.ops, op => q = op(q));

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

