const mongoose = require('mongoose');
const Sequelize = require('sequelize');
const _ = require('lodash');

const models = {};

const monSchema = mongoose.Schema
const MID = mongoose.Schema.ObjectId;

const typeMap2 = {
  [String]: Sequelize.STRING
  , [Number]: Sequelize.FLOAT
  , [Date]: Sequelize.DATE
  , [Boolean]: Sequelize.BOOLEAN
  , [MID]: Sequelize.JSONB
}

const typeMap = {
  [String]: 'Sequelize.STRING'
  , [Number]: 'Sequelize.FLOAT'
  , [Date]: 'Sequelize.DATE'
  , [Boolean]: 'Sequelize.BOOLEAN'
  , [Array]: 'Sequelize.JSONB' // untyped array
  , [Object]: 'Sequelize.JSONB' // untyped object
  , [MID]: 'Sequelize.JSONB' // reference ID
}

const MID_TYPE = typeMap[MID];
const isArrayType = x => Array.isArray(x) && x.length !== 0;

class Schema {
    // Field type conversion (non-collection)
  constructor(params) {
    this.def = params;
  }

  parse() {
    const params = this.def;
    const vTypes = _(params).pickBy(x=>x.type && !x.ref)
      .mapValues(x => ({type:typeMap[x.type]})).value();

    const hasOneType = _(params).pickBy(x=>x.ref)
      .mapValues(x => ({one:x.ref})).value();

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
      .mapValues(x => ({type: MID_TYPE })).value();

    // Collections with schema ref
    const hasManyTypes = _(params).pickBy(isArrayType)
      .pickBy(x => x[0].ref)
      .mapValues(x => ({many:x[0].ref})).value();

    // Defaults on array types
    const vADefaults = _(params).pickBy(isArrayType)
      .pickBy(x=>x[0].default)
      .mapValues(x => ({defaultValue: x[0].default})).value();

    const v = _.merge(vTypes, vATypes, vADefaults, vUnique, vRequired);
    const refs = _.merge(hasOneType, hasManyTypes);
    v.refs = refs;
    return v;
  }
};

class Model {
  constructor(name, schema) {
    this.name = name;
    console.log('-- parsing ' + name + ' --');
    this.sqlm = schema.parse(); // change to build
    this.refs = this.sqlm.refs;
    delete this.sqlm.refs;

    console.log(this.sqlm);
    console.log('refs', this.refs);
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
  sort(field) {

  }
  save() {
    return sqlm.save();
  }
};

// Returns Model
function modelNew(name, schema) {
  const model = new Model(name, schema);
  models[name] = model; // cache it
  return model;
}

module.exports = exports = {
  Schema: Schema,
  model: modelNew
}
