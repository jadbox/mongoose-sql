const _ = require("lodash");
const DEBUG = process.env.DEBUG || 1;
const Query = require('./Query');
const core = require('./mapschema');

let knex = null;
function init(_knex) {
  knex = _knex;
  return { Model, ModelInstance, modelFactory };
}
// Model instance
class ModelInstance {
  constructor(model, vbo) {
    this.vbo = vbo;
    this.model = model;
    //this.sqlz = model.create(vbo);
  }
  remove(cb) {
    return this.model.destroy().then(x => cb()).catch(cb);
  }
  save(cb) {
    return this.model.save(this.vbo).then(x => cb()).catch(cb);
  }
  setKnex(db) {
    this.knex = db;
    return this;
  }
}

function modelFactory(name, schema) {
  if (!_.isObject(schema)) throw new Error("no schema");
  if (!_.isString(name)) throw new Error("no name");

  const model = new Model(name, schema);
  const modelType = function(vbo) {
    return model.create(vbo);
  };

  // copy static methods over
  const fields = [ "find", "findByID", "loaded", "setKnex" ];
  _.forEach(fields, f => modelType[f] = model[f].bind(model));
  modelType.Model = model;

  return modelType;
}

// Base model instances
class Model {
  constructor(name, schema) {
    this.name = name;
    this.Schema = schema;
    if (DEBUG) console.log("-- parsing " + name + " --");
    
  }
  create(vobj) {
    const m = new ModelInstance(this, vobj);
    return m.setKnex(this.knex);
  }
  loaded() {
    return !!this.sqlm;
  }
  find(params) {
    return new Query(this, params, false, this.knex);
  }
  findByID(id) {
    return new Query(this, id, true, this.knex);
  }
  remove(vobj) {
    return this.sqlm.destroy();
  }
  save(vobj, opts) {
    if (!vobj) throw new Error("vobj is null");
    const all_opts = _.merge(SQLZ_INCLUDE_ALL, opts || {});
    return this.sqlm.create(vobj, all_opts);
  }
  setKnex(db) {
    this.knex = db;

    this.schema = core.parse(this.name, this.Schema.def, this.knex);
    console.log();
    console.log("==", this.Schema.def);
    console.log();
    console.log("-", this.schema);

    return this;
  }
}

module.exports = { Model, ModelInstance, modelFactory };