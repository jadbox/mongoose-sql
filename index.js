const mongoose = require('mongoose');
const Sequelize = require('sequelize');
const _ = require('lodash');

const e = process.env;
let DEBUG = 1;
let sequelize;

const models = {};

const monSchema = mongoose.Schema
//const MID = mongoose.Schema.ObjectId;

const typeMap2 = {
  [String]: Sequelize.STRING
  , [Number]: Sequelize.FLOAT
  , [Date]: Sequelize.DATE
  , [Boolean]: Sequelize.BOOLEAN
}

const typeMap = {
  [String]: 'Sequelize.STRING'
  , [Number]: 'Sequelize.FLOAT'
  , [Date]: 'Sequelize.DATE'
  , [Boolean]: 'Sequelize.BOOLEAN'
  , [Array]: 'Sequelize.JSONB' // untyped array
  , [Object]: 'Sequelize.JSONB' // untyped object
}

const ARRAY_OBJ_TYPE = typeMap[Object];
const isArrayType = x => Array.isArray(x) && x.length !== 0;

class Schema {
    // Field type conversion (non-collection)
  constructor(params) {
    this.def = params;
  }

  parse() {
    const params = this.def;

    // Translate mongoose field types to sequelizes
    const vTypes = _(params).pickBy(x=>x.type && !x.ref)
      .mapValues(x => ({type:typeMap[x.type]})).value();

    const hasOneType = _(params).pickBy(x=>x.ref)
      .mapValues(x => ({ref:x.ref, rel:'one'})).value();

    // Default value conversion (non-collection)
    const vDefaults = _(params).pickBy(x=>x.default)
      .mapValues(x => ({defaultValue: x.default})).value();

    // Get Unique field parameters
    const vUnique = _(params).pickBy(x=>x.unique)
      .mapValues(x => ({unique: x.unique})).value();

    // Get Required field parameters
    const vRequired = _(params).pickBy(x=>x.required)
      .mapValues(x => ({ validate: { notNull: true, notEmpty: true } })).value();

    // Collections without schema ref
    const vATypes = _(params).pickBy(isArrayType)
      .pickBy(x => !x[0].ref)
      .mapValues(x => ({type: ARRAY_OBJ_TYPE })).value();

    // Collections with schema ref
    const hasManyTypes = _(params).pickBy(isArrayType)
      .pickBy(x => x[0].ref)
      .mapValues(x => ({ref:x[0].ref, rel: 'many'})).value();

    // Defaults on array types
    const vADefaults = _(params).pickBy(isArrayType)
      .pickBy(x=>x[0].default)
      .mapValues(x => ({defaultValue: x[0].default})).value();

    // Lowercase restrictions on array types
    const vLowerCase = _(params).pickBy(x=>x.lowercase)
      .mapValues(x => ({validate: { isLowercase: true }})).value();

    const v = _.merge(vTypes, vATypes, vADefaults, vUnique, vRequired, vLowerCase);
    const refs = _.merge(hasOneType, hasManyTypes);
    v.refs = refs;
    //console.log(v);
    return v;
  }
};

class Query {
  constructor(model, params) {
    this.model = model;
    this.params = params || {};
    this.ops = [];
  }
  sort(field) {
    this.ops.push({ order: [[field, 'DESC']] })
  }
  exec(cb) {
    this.params = _.merge(this.params, ...ops);
    this.model.findAll(this.params).then(cb);
  }
}

class Model {
  constructor(name, schema) {
    this.name = name;
    if(DEBUG) console.log('-- parsing ' + name + ' --');
    this.schema = schema.parse(); // change to build
    this.refsUnlinked = _.map(this.schema.refs, x => x.ref);
    this.refs = _.merge({}, this.schema.refs);
    delete this.schema.refs;

    if(DEBUG > 1) console.log(this.schema);
    if(DEBUG > 1) console.log('refs', this.refs);
  }
  // Creates the Sequelize models
  _sqlize(models) {
    // sequelize model

    _(this.refs).pickBy(x=>x.rel==='many')
      .map( (k,v) => {
        // hasMany( models[v.ref] )
        return k;
      }).value();

    _(this.refs).pickBy(x=>x.rel==='one')
      .map( (k,v) => {
        // hasOne( models[v.ref] )
        return k;
      }).value();

  }
  find(params) {
    return sqlm.findAll();
  }
  findByID(id) {
    return sqlm.findByID(id)
  }
  remove() {
    return sqlm.destroy();
  }
  save() {
    return sqlm.save();
  }
};

// Returns Model
function modelNew(name, schema) {
  const model = new Model(name, schema);
  models[name] = model; // cache it
  waitOn(model);
  return model;
}

// Check for dependency models added
function waitOn(model) {
  let ks = model.refsUnlinked;
  if(ks.length === 0) {
    if(DEBUG) console.log(model.name + ' has all deps');
    model._sqlize(models);
    return;
  }
  const loaded = _.intersection(ks, _.keys(models));
  
  model.refsUnlinked = ks = _.difference(model.refsUnlinked, loaded);

  if(DEBUG) console.log(model.name + ' loaded', loaded, 'wating on', ks);
  setTimeout(waitOn, 100, model);
}

// Sequelize init
function init(_sequelize) {
  if(DEBUG) console.log('sequelize lib init')
  sequelize = _sequelize
  
  if(DEBUG) sequelize.authenticate()
    .then(x=>console.log('sql connected')
    , y=>console.log('sql connection error', y));
}

if(e.PSQL_INIT || true) {
  init(new Sequelize(
      e.PSQL_DB || 'test'
      , e.PSQL_USER || 'jonathan.dunlap'
      , e.PSQL_PW || ''
      , {
        host: e.PSQL_URL || 'localhost',
        dialect: 'postgres'
     }
  ));
}

module.exports = exports = {
  Schema: Schema
  , model: modelNew
  , init: init
}
