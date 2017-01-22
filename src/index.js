const mongoose = require("mongoose");
//const Sequelize = require("sequelize");
const Knex = require("knex");
let knex = null;
var objection = require("objection");
var OModel = objection.Model;

const Schema = require("./Schema");
const Query = require("./Query");
const { Model, ModelInstance } = require("./Model");

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
  const model = makeModelDef(name, schema);
  // new Model(name, schema);
  if (CONNECT_MONGO && schema.mongo)
    model.mongo = mongoose.model(name, schema.mongo);
  models[name] = model;
  // cache it
  waitOn(model);
  // watch for dependent models
  return model;
}

// Check for dependency models added
// TODO: refactor model.Model
function waitOn(model) {
  const ks = model.Model.refsUnlinked;

  const loadedSQLModels = _.keys(_.pickBy(models, x => x.loaded()));
  console.log("loadedSQLModels", loadedSQLModels);
  const loadedModels = _.intersection(ks, loadedSQLModels);

  // console.log(model.name, model.refsUnlinked)
  model.Model.refsUnlinked = _.difference(
    model.Model.refsUnlinked,
    loadedSQLModels
  );

  if (model.Model.refsUnlinked.length === 0) {
    if (DEBUG) console.log(model.name + " has all deps");
    model._sqlize(models);
    return;
  }

  if (DEBUG)
    console.log(
      model.name + " loaded",
      loadedModels,
      "wating on",
      model.Model.refsUnlinked
    );
  setTimeout(waitOn, 100, model);
}

// Sequelize init
function init(params) {
  if (DEBUG) console.log("sequelize lib init");
  knex = Knex(params);

  if (DEBUG) knex.raw("select 1+1 as result").then(function() {
      console.log("sql connected");
    });
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

module.exports = exports = { Schema: Schema, model: modelNew, init: init };
