const _ = require("lodash");
const DEBUG = process.env.DEBUG || 1;
const Query = require("./Query");
const core = require("./mapschema");

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
    if (!this.Schema.table) throw new Error("invalid table");
    //this.sqlz = model.create(vbo);
  }
  delete(cb) {
    return remove(cb);
  } // alias
  // todo: removeBy
  remove(cb) {
    if (!this.vobj._id) throw new Error("invalid _id");
    return this
      .knex(this.Schema.table)
      .where("_id", this.vobj._id)
      .delete()
      .then(x => {
        cb(null, this.vobj._id);
        return x;
      })
      .catch(cb);
  }
  save(cb) {
    if (!this.vobj) throw new Error("empty object to save");
    return this.knex //this.model.save(this.vobj)
      .insert(this.vobj)
      .into(this.Schema.table)
      .returning("_id")
      .then(x => {
        cb(null, x[0]);
        return x;
      })
      .catch(cb);
  }
  setKnex(db) {
    this.knex = db;
    return this;
  }
}

// Returns a function that creates a ModelInstance
// Function object has non-instance operation methods (like findByID)
function modelFactory(name, schema) {
  if (!_.isObject(schema) || !schema) new Error("no schema");
  if (!_.isString(name)) throw new Error("no name");

  const model = new Model(name, schema);
  const modelType = function(vbo) {
    return model.create(vbo);
  };

  // copy static methods over
  const fields = ["find", "findByID", "loaded", "setKnex", "findOne", "where"];
  _.forEach(fields, f => modelType[f] = model[f].bind(model));
  modelType.Model = model;

  return modelType;
}

// Base model instances
class Model {
  constructor(name, schema) {
    this.name = name;
    this.SchemaWrapper = schema;
    if (DEBUG) console.log("-- parsing " + name + " --");
  }
  create(vobj) {
    const m = new ModelInstance(this.schema, vobj);
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
  findOne(params) {
    return new Query(this, params, true, this.knex);
  }
  remove(vobj, cb) {
    if (!cb) cb = x => x;
    return this.create(vobj).save(cb);
  }
  save(vobj, opts) {
    if (!vobj) throw new Error("vobj is null");
    const all_opts = _.merge(SQLZ_INCLUDE_ALL, opts || {});
    return this.sqlm.create(vobj, all_opts);
  }
  setKnex(db) {
    this.knex = db;

    this.schema = core.parse(this.name, this.SchemaWrapper.def, this.knex);
    return this;
  }
}

module.exports = { Model, ModelInstance, modelFactory };
