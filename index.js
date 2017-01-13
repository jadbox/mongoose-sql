const mongoose = require('mongoose');
const Sequelize = require('sequelize');
const _ = require('lodash');

const e = process.env;
const DEBUG = 1;
const CONNECT_MONGO = e.CONNECT_MONGO || true;
const SQLZ_FORCE = false; // delete and recreate sql tables? #caution
// const DEBUG_SEQUELIZE = false;
let sequelize;

const models = {};
const getModel = function(x) {
  if(!models[x]) throw new Error('Model not loaded: ' + x);
  return models[x];
}

const monSchema = mongoose.Schema
//const MID = mongoose.Schema.ObjectId;

const typeMap = {
  [String]: Sequelize.STRING
  , [Number]: Sequelize.FLOAT
  , 'id': Sequelize.INTEGER
  , [Date]: Sequelize.DATE
  , [Boolean]: Sequelize.BOOLEAN
  , [Array]: Sequelize.JSONB // untyped array
  , [Object]: Sequelize.JSONB // untyped object
}

// For Debugging
const typeMap2 = {
  [String]: 'Sequelize.STRING'
  , [Number]: 'Sequelize.FLOAT'
  , 'id': 'Sequelize.INTEGER'
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
    if(CONNECT_MONGO) this.mongo = new monSchema(params);
  }

  static get ObjectId() { return mongoose.Schema };

  parse() {
    const params = this.def;

    // Translate mongoose field types to sequelizes
    const vTypes = _(params).pickBy(x=>x.type && !x.ref)
      .mapValues(x => ({type:typeMap[x.type]}))
      .value();

    // PATCH: Convert fields that manually link fieds to Integer instead of FLOAT. Ex: Package.cptPackageId
    _(vTypes).toPairs()
      .filter( ([k,v]) => v.type === typeMap[Number] && k.indexOf('Id') > -1)
      .fromPairs()
      .mapValues(x=>({type:typeMap.id}))
      .forEach((v,k) => vTypes[k] = v);

    // Find Has One relations to other objects
    const hasOneType = _(params).pickBy(x=>x.ref)
      .mapValues(x => ({ref:x.ref, rel:'one'})).value();

    // Default value conversion (non-collection)
    const vDefaults = _(params).pickBy(x=>x.default)
      .mapValues(x => {
        if(x.default === Date.now) return { allowNull: false, defaultValue: Sequelize.NOW } //defaultValue: sequelize.fn('NOW') }; // https://github.com/sequelize/sequelize/issues/645
        return {defaultValue: x.default}
      }).value();

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

    const v = _.merge(vTypes, vATypes, vDefaults, vADefaults, vUnique, vRequired, vLowerCase);
    const refs = _.merge(hasOneType, hasManyTypes);
    v.refs = refs;
    //console.log(v);
    return v;
  }
};

const SQLZ_INCLUDE_ALL = { include: [{ all: true}] };
// Chain operations on find() and findByID
class Query {
  constructor(model, params, byID) {
    this.model = model;
    this.params = params || {};
    this.ops = [ SQLZ_INCLUDE_ALL ];
    this.method = byID ? 'findByID' : 'findAll';
  }
  sort(field) {
    this.ops.push({ order: [[field, 'DESC']] })
  }
  exec(cb) {
    this.params = _.merge(this.params, ...ops);
    if(DEBUG) console.log('exec', this.method, this.params);
    this.model[this.method](this.params).then(x => 
      cb(null, x)
    ).catch(cb);
  }
}

// Model instance
class ModelInstance {
  constructor(model, vbo) {
    this.vbo = vbo;
    this.model = model;
    //this.sqlz = model.create(vbo);
  }
  remove(cb) {
    return this.model.destroy().then(x=>cb()).catch(cb);
  }
  save(cb) {
    return this.model.save(this.vbo).then(x=>cb()).catch(cb);
  }
}

function makeModelDef(name, schema) {
  if(!_.isObject(schema)) throw new Error('no schema');
  if(!_.isString(name)) throw new Error('no name');

  const model = new Model(name, schema);
  const modelType = function(vbo) {
    return model.create(vbo);
  }

  const fields = ['find', 'findByID', '_sqlize', 'loaded'];
  _.forEach(fields, 
    f => modelType[f] = model[f].bind(model) 
  );
  modelType.Model = model;

  return modelType;
}

// Base model instances
class Model {
  constructor(name, schema) {
    //this.sqlname = _.snakeCase(name); // todo?
    this.sqlm = {};
    this.name = name;
    if(DEBUG) console.log('-- parsing ' + name + ' --');
    this.schema = schema.parse(); // change to build
    this.refsUnlinked = _.filter(_.map(this.schema.refs, x => x.ref), ref => ref !== name);
    this.refs = _.merge({}, this.schema.refs);
    delete this.schema.refs;

    //if(DEBUG > 1) console.log(this.schema);
    if(DEBUG > 1) console.log('refs', this.refs);
  }
  // Creates the Sequelize models
  _sqlize(models) {
    // sequelize model
    if(!sequelize) {
      console.warn('sequelize not instanced');
      return;
    }

    if(DEBUG) console.log('sequelize model', this.name)
    this.sqlm = sequelize.define(this.name, this.schema);

    // Sync model
    const sqlm = this.sqlm;
    sqlm.sync({force:SQLZ_FORCE})
      .then(x => DEBUG && console.log(this.name, 'sync'));

    // Associate models together
    _(this.refs).pickBy(x=>x.rel==='many')
      .map( (v,k) => {
        if(DEBUG) console.log(this.name, 'hasMany ', v.ref);
        //console.log(models[v.ref].Model);
        sqlm.hasMany( getModel(v.ref).Model.sqlm );
      }
      ).value();

    _(this.refs).pickBy(x=>x.rel==='one')
      .map( (v,k) => {
        if(DEBUG) console.log(this.name, 'hasOne ', v.ref);
        console.log('models', _.keys(models));
        sqlm.hasOne( getModel(v.ref).Model.sqlm )
      }).value();

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
    if( !vobj ) throw new Error('vobj is null');
    const all_opts = _.merge(SQLZ_INCLUDE_ALL, opts || {});
    console.log('saving', _.keysIn(vobj));
    return this.sqlm.create(vobj, all_opts);
  }
};

// Model factor method: returns Model
function modelNew(name, schema) {

  const model = makeModelDef(name, schema); // new Model(name, schema);
  if(CONNECT_MONGO && schema.mongo) model.mongo = mongoose.model(name, schema.mongo);
  models[name] = model; // cache it
  waitOn(model); // watch for dependent models
  return model;
}

// Check for dependency models added
// TODO: refactor model.Model
function waitOn(model) {
  const ks = model.Model.refsUnlinked;

  const loadedSQLModels = _.keys(_.pickBy(models, x => x.loaded() ));
  console.log('loadedSQLModels', loadedSQLModels);
  const loadedModels = _.intersection(ks, loadedSQLModels);
  
  // console.log(model.name, model.refsUnlinked)
  model.Model.refsUnlinked = _.difference(model.Model.refsUnlinked, loadedSQLModels);

  if(model.Model.refsUnlinked.length === 0) {
    if(DEBUG) console.log(model.name + ' has all deps');
    model._sqlize(models);
    return;
  }

  if(DEBUG) console.log(model.name + ' loaded', 
    loadedModels, 'wating on', model.Model.refsUnlinked);
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
