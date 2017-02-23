const _ = require('lodash');
const DEBUG = process.env.DEBUG || 0;

// many to many
function makeAgg(knex, k, field) {
  return knex.raw('json_agg(x' + k + ') AS "' + field + '"');
}

// Many to many select field with only _id field
function makeAggId(knex, k, field) {
  return knex.raw('json_agg(x' + k + '._id) AS "' + field + '"');
}

// one to many
function makeRow(knex, k, field) {
  return knex.raw('row_to_json(x' + k + ') AS "' + field + '"');
}

let i = 0; // keep global query operation id

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
    this._i = ++i;
    this.excludeFields = [];
  }
  findOne(params) {
    if (!isNaN(parseFloat(this.params))) this.params = params;
    else if (params && this.params) this.params = _.merge(this.params, params);

    this.justOne = true;
    return this;
  }
  findByID(params) {
    return this.findOne(params);
  }
  findById(params) {
    return this.findByID(params);
  }
  find(params) {
    this.findOne(params);
    this.justOne = false;
    return this;
  }
  sort(field) {
    // TODO: POPULATE
    if (field.charAt(0) !== '-')
      this.ops.push(q => q.orderBy(this.schema.table + '.' + field)); //'desc'
    else {
      field = field.substring(1);
      this.ops.push(q => q.orderBy(this.schema.table + '.' + field, 'desc'));
    }
    return this;
  }
  select(field) {
    if (field.charAt(0) === '-') this.excludeFields.push(field.substring(1));
    else throw new Error('additional select field', field);
    return this;
    // TODO: secondary select
  }
  populate(model1, model2) {
    if (Array.isArray(model1)) this.populateFields.push(...model1);
    else {
      if(model1.indexOf('-') === 0) this.excludeFields.push(model1.substring(1));
      else this.populateFields.push(model1);
    }

    if (model2) {
      if(model2.indexOf('-') === 0) this.excludeFields.push(model2.substring(1));
      else this.populateFields.push(model2);
    }
    return this;
  }
  exec(cb) {
    // if (DEBUG) console.log('exec', this.method);
    const _schema = this.schema;
    if (!_schema) throw new Error('missing schema state');

    const many = makeAgg.bind(null, this.knex);
    const manyID = makeAggId.bind(null, this.knex);
    const one = makeRow.bind(null, this.knex);

    // aggregate fields with any needed join table columns
    let fields = ['*']
    if(this.excludeFields.length > 0) {
      fields = _.without(_.keys(_schema.props), ...this.populateFields, ...this.excludeFields);
      fields.push('_id');
    }
    const fieldsToTable = _.map(fields, f => _schema.table + '.' + f);

    const linkedRefs = _(this.schema.refs)
        .map((f, K) => {
          const fullJoin = _.includes(this.populateFields, f);
          if (_schema.joins[f]) {
            if (fullJoin) return many(K, f);
            else return manyID(K, f);
          }
          if (fullJoin && _schema.props[f]) return one(K, f);
          return null;
          /* Validate invalid populate fields
        else if(!_schema.joins[f] && _schema.props[f]) {
          console.log( f);
          throw new Error('unlisted field ' + f);
        }*/
        })
        .filter(null);

    const extra = [
      ...fieldsToTable,
      ...linkedRefs,
    ];

    // Select fields
    let q = this.knex.select(...extra).from(_schema.table);

    // Ordering
    _.forEach(this.ops, op => q = op(q));

    // Where clauses
    if (_.isObject(this.params)) {
      // Fixes where fields that are ambiguous to the table
      this.params = _.mapKeys(
        this.params,
        (v, k) => this.schema.table + '.' + k
      );
      q = q.where(this.params);
    } else if (!isNaN(parseFloat(this.params)))
      q = q.where(this.schema.table + '._id', parseFloat(this.params));

    // == Nested many-many group
    _.forEach(this.schema.refs, (f, K) => {
      const prop = _schema.joins[f];
      if (!prop) return;
      //if(!prop) throw new Error('field not found '+f);

      const key = 'x' + K;
      q = q
        .leftOuterJoin(
          prop.ltable + ' AS L',
          _schema.table + '._id',
          'L.' + _schema.table
        )
        .leftOuterJoin(prop.refTable + ' AS ' + key, 'L.' + f, key + '._id');
    });

    // == Nested one-many group
    const extraOrders = []; // order fix for row_to_json selection
    _.forEach(this.schema.refs, (f, K) => {
      const prop = _schema.props[f];
      if (!prop) return;
      //if(!prop) throw new Error('field not found '+f);

      const key = 'x' + K;
      extraOrders.push(key);
      q = q.leftOuterJoin(
        prop.refTable + ' AS ' + key,
        _schema.table + '.' + f,
        key + '._id'
      );
    });

    if (this.populateFields.length)
      q = q.groupBy(_schema.table + '._id', ...extraOrders);
    else
      q = q.groupBy(_schema.table + '._id');

    //console.log( this._i, q.toString() );
    return q.then(x => {
      //console.log(this._i, 'returned')
      // extract single element
      if (this.justOne) {
        x = x.length > 0 ? x[0] : null;
        if (x) x = this.model.create(x); // convert to ModelInstance
      }
      else {
        x = _.map(x, y => this.model.create(y));
      }

      if (cb) cb(null, x);
      return x;
    });
  }
};
