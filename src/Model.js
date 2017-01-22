const _ = require("lodash");
const DEBUG = process.env.DEBUG || 1;

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
}

function makeModelDef(name, schema) {
  if (!_.isObject(schema)) throw new Error("no schema");
  if (!_.isString(name)) throw new Error("no name");

  const model = new Model(name, schema);
  const modelType = function(vbo) {
    return model.create(vbo);
  };

  const fields = [ "find", "findByID", "_sqlize", "loaded" ];
  _.forEach(fields, f => modelType[f] = model[f].bind(model));
  modelType.Model = model;

  return modelType;
}

// Base model instances
class Model {
  constructor(name, schema) {
    //this.sqlname = _.snakeCase(name); // todo?
    this.sqlm = {};
    this.name = name;
    if (DEBUG) console.log("-- parsing " + name + " --");
    this.schema = schema.parse(name);
    // change to build
    this.refsUnlinked = _.filter(
      _.map(this.schema.refs, x => x.ref),
      ref => ref !== name
    );
    this.refs = _.merge({}, this.schema.refs);
    delete this.schema.refs;

    //if(DEBUG > 1) console.log(this.schema);
    if (DEBUG > 1) console.log("refs", this.refs);
  }
  // Creates the Sequelize models
  _sqlize(models) {
    // sequelize model
    if (!sequelize) {
      console.warn("sequelize not instanced");
      return;
    }

    if (DEBUG) console.log("sequelize model", this.name);
    this.sqlm = sequelize.define(this.name, this.schema);

    // Sync model
    const sqlm = this.sqlm;
    sqlm
      .sync({ force: SQLZ_FORCE })
      .then(x => DEBUG && console.log(this.name, "sync"));

    // Associate models together
    _(this.refs)
      .pickBy(x => x.rel === "many")
      .map((v, k) => {
        //
        //console.log(models[v.ref].Model);
        const other = getModel(v.ref).Model.sqlm;
        const through = _.upperFirst(_.camelCase(sqlm.name + " " + other.name));
        //throw new Error(through);
        //sqlm.hasMany(other , { as: k, through } );
        other.belongsToMany(sqlm, { as: k, through });
        if (DEBUG)
          console.log(this.name, "hasMany ", v.ref, { as: k, through });
      })
      .value();

    _(this.refs)
      .pickBy(x => x.rel === "one")
      .map((v, k) => {
        if (DEBUG) console.log(this.name, "hasOne ", v.ref, { as: k });
        console.log("models", _.keys(models));
        sqlm.hasOne(getModel(v.ref).Model.sqlm, { as: k });
      })
      .value();
  }
  create(vobj) {
    return new ModelInstance(this, vobj);
  }
  loaded() {
    return !!this.sqlm;
  }
  find(params) {
    return new Query(this, params, false);
  }
  findByID(id) {
    return new Query(this, id, true);
  }
  remove(vobj) {
    return this.sqlm.destroy();
  }
  save(vobj, opts) {
    if (!vobj) throw new Error("vobj is null");
    const all_opts = _.merge(SQLZ_INCLUDE_ALL, opts || {});
    return this.sqlm.create(vobj, all_opts);
  }
}

module.exports = { Model, ModelInstance };