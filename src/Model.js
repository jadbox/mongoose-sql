const _ = require('lodash');
const DEBUG = process.env.DEBUG || 1;
const Query = require('./Query');
const core = require('./mapschema');
const Promise = require('q').Promise;

const TYPE_JSONB = 'jsonb';

// Knex db context
let knex = null;
function init(_knex) {
  knex = _knex;
  return { Model, ModelInstance, modelFactory };
}

// Allows access to model props from base ModelInstance.vobj property
function makeInstanceProxy(model) {
  return new Proxy(model, {
    get: function(target, name) {
      if (!(name in target)) {
        return model.vobj[name];
      }
      return target[name];
    },
    set: function(target, name, value) {
      if (!(name in target)) {
        model.vobj[name] = value;
      }
      return true;
    }
  });
}

// Model instance
class ModelInstance {
  constructor(Schema, vobj) {
    this.vobj = vobj;
    this.Schema = Schema;
    if (!this.Schema.table) throw new Error('invalid table');
  }
  toJSON() {
    return this.vobj;
  }
  toString() {
    return JSON.toString(this.toJSON());
  }
  toObject() {
    return this.vobj;
  }
  delete(cb) {
    return remove(cb);
  } 
  // Delete this model (requires _id to be set)
  remove(cb) {
    const id = this.vobj._id;
    if (!id) throw new Error('invalid _id');
    return this
      .knex(this.Schema.table)
      .where('_id', id)
      .delete()
      .then(x => {
        if (cb) cb(null, id);
        return id;
      })
      .catch(cb);
  }

  // Save performs an upsert operation
  save(cb) {
    const s = this.Schema;
    let vobj = this.vobj;
    vobj = removeInvalidFields(s, vobj);
    vobj = correctJsonFields(s, vobj);

    if (!vobj) throw new Error('empty object to save');
    const removedJoins = _(vobj).pickBy((v, k) => !s.joins[k]).value(); // remove joins

    return this.knex.transaction(trx => {
      upsertItem(this.knex, s.table, removedJoins, trx)
        .then(ids => this.vobj._id = ids[0]) // save model's id
        .then(id => this._saveAssociations(id, vobj, trx).then(() => id))
        .then(trx.commit)
        .catch(trx.rollback)
    })
    .then(id => {
      if (cb) cb(null, id);
      return id;
    })
    .catch(err => { if(cb) cb(err); })
  }

  // Save to all related join tables
  _saveAssociations(id, vobj, trx) {
    const s = this.Schema;
    let q = Promise.resolve(id);
    // for each join field
    _.forEach(s.joins, (j, key) => {
      if (!vobj[key]) {
        console.log('no relationship elements to save');
        return;
      }
      const batch = _.map(vobj[key], val => ({ [key]: val, [s.table]: id }));

      // delete old join records
      q = q.then(z => 
        this.knex(j.ltable).transacting(trx).where(s.table, id).delete()
      );

      // Insert all many related elements to field at once
      if (batch.length > 0)
        q = q.then(
          () =>
            this.knex.batchInsert(j.ltable, batch).transacting(trx)
        );
    });

    return q;
  }

  setKnex(db) {
    this.knex = db;
    return this;
  }
}

// Returns a function that creates a ModelInstance
// Function object has non-instance static operation methods of Model (like findByID)
function modelFactory(name, schema) {
  if (!_.isObject(schema) || !schema) new Error('no schema');
  if (!_.isString(name)) throw new Error('no name');

  const model = new Model(name, schema);
  const modelType = function(vbo) {
    return model.create(vbo);
  };

  // copy static methods over
  const fields = [
    'find',
    'findByID',
    'findById',
    'setKnex',
    'findOne',
    'where'
  ];
  _.forEach(fields, f => modelType[f] = model[f].bind(model));
  modelType.Model = model;
  modelType.schema = model.schema;

  return modelType;
}

// Base model instances
class Model {
  constructor(name, schema) {
    this.name = name;
    this.schema = schema;
    if (DEBUG) console.log('-- parsing ' + name + ' --');
  }
  create(vobj) {
    const m = new ModelInstance(this._schema, vobj);
    m.setKnex(this.knex);
    const proxyModel = makeInstanceProxy(m);
    return proxyModel;
  }
  where(params) {
    return this.find(params);
  }
  find(params) {
    return new Query(this, params, false, this.knex);
  }
  // Returns models
  findByID(id) {
    return this.findOne(id);
  }
  findById(id) {
    // alias
    return this.findByID(id);
  }
  findOne(params) {
    return new Query(this, params, true, this.knex);
  }
  remove(vobj, cb) {
    return this.create(vobj).remove(cb);
  }
  setKnex(db) {
    this.knex = db;
    // if(_.toLower(this.name)==='package') console.log('==', this.name, this.schema.obj);
    this._schema = core.parse(this.name, this.schema.obj, this.knex);
    return this;
  }
}

module.exports = { Model, ModelInstance, modelFactory };

/**
 * Perform an "Upsert" using the "INSERT ... ON CONFLICT ... " syntax in PostgreSQL 9.5
 * @link http://www.postgresql.org/docs/9.5/static/sql-insert.html
 *
 * @param {string} tableName - The name of the database table
 * @param {Object} itemData - a hash of properties to be inserted/updated into the row
 * @returns {Promise} - A Promise which resolves to the inserted/updated row
 */
function _upsertItem(knex, tableName, itemData, trx) {
  const insert = knex(tableName).insert(itemData).toString();
  const itemDataWithoutId = _.omit(itemData, '_id');
  const update = knex(tableName)
    .update(itemDataWithoutId)
    .returning(tableName + '._id');
  const updateFix = update
    .toString()
    .replace(/^update ([`"])[^\1]+\1 set/i, '');

  let query = `${insert} ON CONFLICT (_id) DO UPDATE SET ${updateFix}`;
  return knex.raw(query).transacting(trx).then(x => {
    return [x.rows[0]._id];
  });
}

// Simple insert operation
function insertItem(knex, tableName, itemData, trx) {
  const q = knex.insert(itemData).into(tableName).returning('_id').transacting(trx);

  return q; //.then(x => {console.log(x); return x; });
}

// Insert or update element, depending on if model has _id
function upsertItem(knex, tableName, itemData, trx) {
  if (Array.isArray(itemData)) {
    return Promise.map(itemData, i => {
      if (itemData._id) return _upsertItem(knex, tableName, i, trx);
      else return insertItem(knex, tableName, i);
    });
  } else {
    if (itemData._id) return _upsertItem(knex, tableName, itemData, trx);
    else return insertItem(knex, tableName, itemData, trx);
  }
}

// stringify jsonb fields
function correctJsonFields(_schema, obj) {
  const r = _(obj)
    .pickBy((v, k) => !_schema.joins[k] && (_.isObject(v) || _.isArray(v)))
    //.pickBy((v, k) => _schema.props[k] && _schema.props[k].type === TYPE_JSONB)
    .mapValues(JSON.stringify)
    .value();

  return _.merge(obj, r);
}

// Remove fields that are not specified in the schema
function removeInvalidFields(_schema, obj) {
  const r = _(obj)
    .pickBy((v, k) => k !== '_id' && !_schema.props[k] && !_schema.joins[k])
    .keys()
    .value();

  return _.omit(obj, ...r);
}
