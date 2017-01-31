//const mongoose = require("mongoose");
const Knex = require("knex");
const core = require("./mapschema");
let knex = null;

const Schema = require("./Schema");
const Query = require("./Query");
const { Model, ModelInstance, modelFactory } = require("./Model");

const _ = require("lodash");

const e = process.env;
const DEBUG = process.env.DEBUG || 1;
const CONNECT_MONGO = e.CONNECT_MONGO || false;
const SQLZ_FORCE = true;
// delete and recreate sql tables? #caution
// const DEBUG_SEQUELIZE = false;
const models = {};
const getModel = function(x) {
  if (!models[x]) throw new Error("Model not loaded: " + x);
  return models[x];
};

// Model factor method: returns Model
function modelNew(name, schema) {
  const model = modelFactory(name, schema);
  model.setKnex(knex);
  // new Model(name, schema);
  ///if (CONNECT_MONGO && schema.mongo)
  //  model.mongo = mongoose.model(name, schema.mongo);
  models[name] = model;
  return model;
}

// Sequelize init, returns knex instance
function init(params) {
  if (DEBUG) console.log("sequelize lib init");
  knex = Knex(params);

  if (DEBUG) knex.raw("select 1+1 as result").then(function() {
      console.log("sql connected");
    });

  return knex;
}

if (e.PSQL_INIT || true) {
  init({
    client: e.DB_CLIENT || "pg",
    connection: {
      host: e.DB_HOST || "127.0.0.1",
      user: e.DB_USER || "jonathan.dunlap",
      password: e.DB_PASSWORD || "",
      database: e.DB_DATABASE || "test"
    }
  });
}

module.exports = exports = {
  Schema: Schema,
  model: modelNew,
  getKnex: () => knex,
  init: init,
  connect: init,
  createConnection: init,
  migrateSchemas: core.migrateSchemas
};
