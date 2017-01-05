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
  , [Array]: 'complex'
  , [MID]: 'Sequelize.TEXT'
}

const typeMap = {
  [String]: 'Sequelize.STRING'
  , [Number]: 'Sequelize.FLOAT'
  , [Date]: 'Sequelize.DATE'
  , [Boolean]: 'Sequelize.BOOLEAN'
  , [Array]: 'complex'
  , [MID]: 'Sequelize.TEXT' // reference ID
}

const MID_TYPE = typeMap[MID];
const isArrayType = x => Array.isArray(x) && x.length !== 0;

class Schema {
    // Field type conversion (non-collection)
  constructor(params) {
    const vTypes = _(params).pickBy(x=>x.type)
      .mapValues(x => ({type:typeMap[x.type]})).value();

    // Default value conversion (non-collection)
    const vDefaults = _(params).pickBy(x=>x.default)
      .mapValues(x => ({defaultValue: x.default})).value();

    const vUnique = _(params).pickBy(x=>x.unique)
      .mapValues(x => ({unique: x.unique})).value();

    // const keys = Object.keys(params);
    // Collections without schema ref
    const vATypes = _(params).pickBy(isArrayType)
      .pickBy(x => !x[0].ref)
      .mapValues(x => ({type: MID_TYPE })).value();

    // Collections with schema ref
    const vACTypes = _(params).pickBy(isArrayType)
      .pickBy(x => x[0].ref)
      .mapValues(x => ({
        type: '------------' + x[0].ref
      })).value();

    // Defaults on array types
    const vADefaults = _(params).pickBy(isArrayType)
      .pickBy(x=>x[0].default)
      .mapValues(x => ({defaultValue: x[0].default})).value();

    const v = _.merge(vTypes, vTypes, vATypes, vACTypes, vADefaults, vUnique);
    console.log(v);
  }
};

class Model {
  constructor(params) {
  }
  find(params) {

  }
  findByID(id) {

  }
};

// Returns Model
function modelNew(name, schema) {
  const model = new Model(schema);
  models[name] = model; // cache it
  return model;
}

module.exports = exports = {
  Schema: Schema,
  model: modelNew
}
