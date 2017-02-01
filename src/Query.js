const _ = require("lodash");
const DEBUG = process.env.DEBUG || 1;

// many to many
function makeAgg(knex, k, field) {
  return knex.raw("json_agg(x" + k + ') AS "' + field + '"');
}
// one to many
function makeRow(knex, k, field) {
  return knex.raw("row_to_json(x" + k + ') AS "' + field + '"');
}

// Chain operations on find() and findjustOne
module.exports = class Query {
  constructor(model, params, justOne, _knex) {
    this.knex = _knex;
    this.model = model;
    this.schema = model._schema; // sugar
    this.params = params; // || {};
    this.populateFields = [];
    this.ops = [];
    this.justOne = justOne;
  }
  findOne(params) {
    if (params && this.params) this.params = _.merge(this.params, params);
    this.justOne = true;
    return this;
  }
  find(params) {
    findOne(params);
    this.justOne = false;
    return this;
  }
  sort(field) {
    // TODO: POPULATE
    this.ops.push(q => q.orderBy(this.schema.table + "." + field)); //'desc'
    return this;
  }
  select(field) {
    if(field.charAt(0) === '-') console.log('TODO select by', field);
    else throw new Error('additional select field', field);
    return this;
    // TODO: secondary select
  }
  populate(model1, model2) {
    // TODO: POPULATE
    if (model1) this.populateFields.push(model1);
    if (model2) this.populateFields.push(model2);
    return this;
  }
  exec(cb) {
    // if (DEBUG) console.log("exec", this.method);
    const _schema = this.schema;
    if(!_schema) throw new Error('missing schema state');

    const many = makeAgg.bind(null, this.knex);
    const one = makeRow.bind(null, this.knex);

    // aggregate fields with any needed join table columns
    const extra = [_schema.table + ".*", ..._.map(this.populateFields, (
        f,
        k
      ) => {
        if (_schema.joins[f]) return many(k, f);
        else if (_schema.props[f]) return one(k, f);
        else {
          console.log( _schema );
          console.log( _.keys(_schema.joins) );
          console.log( _.keys(_schema.props) );
          throw new Error("unlisted field " + f);
        }
      })];

    // Select fields
    let q = this.knex.select(...extra).from(_schema.table);

    // Ordering
    _.forEach(this.ops, op => q = op(q));

    // Where clauses
    if (this.params && _.isObject(this.params)) {
      q = q.where(this.params);
    } else if (this.params && !isNaN(parseFloat(this.params)))
      q = q.where(this.schema.table + "._id", parseFloat(this.params));

    // == Nested many-many group
    _.forEach(this.populateFields, (f, K) => {
      const prop = _schema.joins[f];
      if (!prop) return;
      //if(!prop) throw new Error('field not found '+f);

      const key = "x" + K;
      q = q
        .leftOuterJoin(
          prop.ltable + " AS L",
          _schema.table + "._id",
          "L." + _schema.table
        )
        .leftOuterJoin(prop.refTable + " AS " + key, "L." + f, key + "._id");
    });

    // == Nested one-many group
    const extraOrders = []; // order fix for row_to_json selection
    _.forEach(this.populateFields, (f, K) => {
      const prop = _schema.props[f];
      if (!prop) return;
      //if(!prop) throw new Error('field not found '+f);

      const key = "x" + K;
      extraOrders.push(key);
      q = q.leftOuterJoin(
        prop.refTable + " AS " + key,
        _schema.table + "." + f,
        key + "._id"
      );
    });

    if (this.populateFields.length)
      q = q.groupBy(_schema.table + "._id", ...extraOrders);

    // extract single element
    if (this.justOne) q = q.then(x => x.length > 0 ? x[0] : null);

    //console.log( q.toSQL() );

    return q.then(x => cb(null, x));
    //this.model[this.method](this.params).then(x => cb(null, x)).catch(cb);
  }
};
