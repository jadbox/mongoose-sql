//const mongoose = require('mongoose');
const Knex = require('knex');
const core = require('./mapschema');
const { migrate, migrateSchemas } = require('./migrate');
let knex = null;

const Schema = require('./Schema');
const Query = require('./Query');
const { Model, ModelInstance, modelFactory } = require('./Model');

const _ = require('lodash');

const e = process.env;
const DEBUG = process.env.DEBUG || 1;
const CONNECT_MONGO = e.CONNECT_MONGO || false;
const SQLZ_FORCE = true;
// delete and recreate sql tables? #caution
// const DEBUG_SEQUELIZE = false;

// Global state used to replicate Mongoose registry
const models = {};

class Connection {
  constructor(knex) {
    this.knex = knex;
    this.collections = {
      caches: {
        drop: (x, cb) => {
          console.log('caches STUB ' + x);
          if (cb) cb();
        }
      }
    };
  }
  on(name, fn) {
    //name == connected
    if (name === 'connected') setTimeout(x => fn(), 100); // connection delay
  }
}

// Model factor method: returns Model
// 2nd param schema is optional if cached before
function modelNew(name, schema) {
  if (models[name]) return models[name];

  if (!schema) throw new Error('no schema provided or in cache: ' + name);
  const model = modelFactory(name, schema);
  model.setKnex(knex);
  // new Model(name, schema);
  ///if (CONNECT_MONGO && schema.mongo)
  //  model.mongo = mongoose.model(name, schema.mongo);
  models[name] = model;
  return model;
}

// Sequelize init, returns knex instance
function connect(params) {
  // if (DEBUG) console.log('sequelize lib init');
  if (!knex) {
    knex = Knex(params);
    if (DEBUG) knex.raw('select 1+1 as result').then(function() {
        console.log('sql connected');
      });
  }

  return {
    connection: new Connection(knex)
  };
}

if (e.PSQL_INIT) {
  connect({
    client: e.DB_CLIENT || 'pg',
    connection: {
      host: e.DB_HOST || '127.0.0.1',
      user: e.DB_USER || 'jonathan.dunlap',
      password: e.DB_PASSWORD || '',
      database: e.DB_DATABASE || 'test',
      port: e.DB_PORT || 5432
    }
  });
}

module.exports = exports = {
  Schema: Schema,
  model: modelNew,
  getKnex: () => knex,
  get knex() { return knex },
  init: connect,
  connect: connect,
  createConnection: connect,
  migrateSchemas: migrateSchemas,
  migrate: migrate
};
