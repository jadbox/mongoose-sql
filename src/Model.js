const _ = require('lodash');
const DEBUG = process.env.DEBUG || 1;
const Query = require('./Query');
const core = require('./mapschema');

// Knex db context
let knex = null;
function init(_knex) {
  knex = _knex;
  return { Model, ModelInstance, modelFactory };
}

// Model instance
class ModelInstance {
  constructor(Schema, vobj) {
    this.vobj = vobj;
    //this.model = model;
    this.Schema = Schema; // sugar
    //console.log('this.Schema', this.Schema)
    if (!this.Schema.table) throw new Error('invalid table');
    //this.sqlz = model.create(vbo);
  }
  delete(cb) {
    return remove(cb);
  } // alias
  // todo: removeBy
  remove(cb) {
    const id = this.vobj._id;
    if (!id) throw new Error('invalid _id');
    return this
      .knex(this.Schema.table)
      .where('_id', id)
      .delete()
      .then(x => {
        if(cb) cb(null, id);
        return id;
      })
      .catch(cb);
  }

  save(cb) {
    const vobj = this.vobj;
    if (!vobj) throw new Error('empty object to save');
    const removedJoins = _(vobj).pickBy( (v,k) => !this.Schema.joins[k] ).value(); // remove joins
    return this.knex //this.model.save(this.vobj)
      .insert(removedJoins)
      .into(this.Schema.table)
      .returning('_id')
      .then( ids => vobj._id = ids[0] ) // save model's id
      .then( id => this._saveAssociations(id).then(()=>id) )
      .then(id => {
        if(cb) cb(null, id);
        return id;
      })
      .catch(cb);
  }

  _saveAssociations(id) {
    let q = Promise.resolve(id);
    const s = this.Schema;
    // for each join field
    _.forEach(s.joins, (j,key) => {
      if(!this.vobj[key]) {
        console.log('no relationship elements to save');
        return;
      }
      //console.log('joining', key);
      const batch = _.map(this.vobj[key], val =>
        ({ [key]: val, [s.table]: id })
      );
      // Insert all many related elements to field at once
      if(batch.length > 0) q = q.then(() => this.knex.batchInsert(j.ltable, batch));
    });

    return q;
  }

  setKnex(db) {
    this.knex = db;
    return this;
  }
}

// Returns a function that creates a ModelInstance
// Function object has non-instance operation methods (like findByID)
function modelFactory(name, schema) {
  if (!_.isObject(schema) || !schema) new Error('no schema');
  if (!_.isString(name)) throw new Error('no name');

  const model = new Model(name, schema);
  const modelType = function(vbo) {
    return model.create(vbo);
  };

  // copy static methods over
  const fields = ['find', 'findByID', 'findById', 
      'loaded', 'setKnex', 'findOne', 'where'];
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
    return m.setKnex(this.knex);
  }
  loaded() {
    return !!this.sqlm;
  }
  where(params) {
    return this.find(params);
  }
  find(params) {
    return new Query(this, params, false, this.knex);
  }
  findByID(id) {
    return this.findOne(id);
  }
  findById(id) { // alias
    return this.findByID(id);
  }
  findOne(params) {
    return new Query(this, params, true, this.knex);
  }
  remove(vobj, cb) {
    if (!cb) cb = x => x;
    return this.create(vobj).save(cb);
  }
  save(vobj, opts) {
    if (!vobj) throw new Error('vobj is null');
    const all_opts = _.merge(SQLZ_INCLUDE_ALL, opts || {});
    return this.sqlm.create(vobj, all_opts);
  }
  setKnex(db) {
    this.knex = db;
    // if(_.toLower(this.name)==='package') console.log('==', this.name, this.schema.obj);
    this._schema = core.parse(this.name, this.schema.obj, this.knex);
    return this;
  }
}

module.exports = { Model, ModelInstance, modelFactory };
