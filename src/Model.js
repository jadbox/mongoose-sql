const _ = require('lodash');
const DEBUG = process.env.DEBUG || 1;
const Query = require('./Query');
const core = require('./mapschema');
const Promise = require('q').Promise;

const TYPE_JSONB = 'jsonb';

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
    if (!this.Schema.table) throw new Error('invalid table');
    //this.sqlz = model.create(vbo);
  }
  toJSON() {
    return JSON.stringify(this.vobj);
  }
  toString() {
    return toJSON();
  }
  delete(cb) {
    return remove(cb);
  } // alias
  // todo: removeBy
  remove(cb) {
    const id = this.vobj._id;
    if (!id) throw new Error('invalid _id');
    return this
      .knex(this.Schema.table)
      .where('_id', id)
      .delete()
      .then(x => {
        if(cb) cb(null, id);
        return id;
      })
      .catch(cb);
  }

  // Todo upsert
  save(cb) {
    const s = this.Schema;
    let vobj = this.vobj;
    vobj = removeInvalidFields(s, vobj);
    vobj = correctJsonFields(s, vobj);
    
    if (!vobj) throw new Error('empty object to save');
    const removedJoins = _(vobj).pickBy( (v,k) => !s.joins[k] ).value(); // remove joins
    
    return upsertItem(this.knex, s.table, removedJoins) 
      //this.knex //this.model.save(this.vobj)
      //.insert(removedJoins)
      //.into(this.Schema.table)
      //.returning('_id')
      .then( ids => this.vobj._id = ids[0] ) // save model's id
      .then( id => this._saveAssociations(id, vobj).then(()=>id) )
      .then(id => {
        if(cb) cb(null, id);
        return id;
      })
      .catch(cb);
  }

  _saveAssociations(id, vobj) {
    const s = this.Schema;
    let q = Promise.resolve(id);
    // for each join field
    _.forEach(s.joins, (j,key) => {
      if(!vobj[key]) {
        console.log('no relationship elements to save');
        return;
      }
      //console.log('joining', key);
      const batch = _.map(vobj[key], val =>
        ({ [key]: val, [s.table]: id })
      );
      // Insert all many related elements to field at once
      if(batch.length > 0) q = q.then(() => this.knex.batchInsert(j.ltable, batch));
    });

    return q;
  }

  setKnex(db) {
    this.knex = db;
    return this;
  }
}

// Returns a function that creates a ModelInstance
// Function object has non-instance operation methods (like findByID)
function modelFactory(name, schema) {
  if (!_.isObject(schema) || !schema) new Error('no schema');
  if (!_.isString(name)) throw new Error('no name');

  const model = new Model(name, schema);
  const modelType = function(vbo) {
    return model.create(vbo);
  };

  // copy static methods over
  const fields = ['find', 'findByID', 'findById', 
      'setKnex', 'findOne', 'where'];
  _.forEach(fields, f => modelType[f] = model[f].bind(model));
  modelType.Model = model;
  modelType.schema = model.schema;

  return modelType;
}

// Base model instances
class Model {
  constructor(name, schema) {
    this.name = name;
    this.schema = schema;
    if (DEBUG) console.log('-- parsing ' + name + ' --');
  }
  create(vobj) {
    const m = new ModelInstance(this._schema, vobj);
    return m.setKnex(this.knex);
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
  findById(id) { // alias
    return this.findByID(id);
  }
  findOne(params) {
    return new Query(this, params, true, this.knex);
  }
  remove(vobj, cb) {
    return this.create(vobj).remove(cb);
  }
  /*save(vobj, opts) {
    if (!vobj) throw new Error('vobj is null');
    const all_opts = _.merge(SQLZ_INCLUDE_ALL, opts || {});
    return this.sqlm.create(vobj, all_opts);
  }*/
  setKnex(db) {
    this.knex = db;
    // if(_.toLower(this.name)==='package') console.log('==', this.name, this.schema.obj);
    this._schema = core.parse(this.name, this.schema.obj, this.knex);
    return this;
  }
}

module.exports = { Model, ModelInstance, modelFactory };

/**
 * Perform an "Upsert" using the "INSERT ... ON CONFLICT ... " syntax in PostgreSQL 9.5
 * @link http://www.postgresql.org/docs/9.5/static/sql-insert.html
 * @author https://github.com/plurch
 *
 * @param {string} tableName - The name of the database table
 * @param {string} conflictTarget - The column in the table which has a unique index constraint
 * @param {Object} itemData - a hash of properties to be inserted/updated into the row
 * @returns {Promise} - A Promise which resolves to the inserted/updated row
 */
function _upsertItem(knex, tableName, itemData) {
  const insert = knex(tableName).insert(itemData).toString();
  const itemDataWithoutId = _.omit(itemData, '_id');
  const update = knex(tableName).update(itemDataWithoutId).returning(tableName+'._id');
  const updateFix = update.toString().replace(/^update ([`"])[^\1]+\1 set/i, '');

  //let query = `${insert} ON DUPLICATE KEY UPDATE ${updateFix}`;
  let query = `${insert} ON CONFLICT (_id) DO UPDATE SET ${updateFix}`;
  // console.log('+', tableName, query);
  return knex.raw(query).then(x => {
    // console.log('--', x.rows[0]._id)
    return [ x.rows[0]._id ];
  })
  /*
   let exclusions = _.keys(itemData)
       .filter(c => c !== conflictTarget)
       .map(c => knex.raw('?? = EXCLUDED.??', [c, c]).toString())
       .join(",\n");
   
   let insertString = knex(tableName).insert(itemData).toString();
   let conflictString = knex.raw(` ON CONFLICT (??) DO UPDATE SET ${exclusions} RETURNING *;`, conflictTarget).toString();
   let query = (insertString + conflictString).replace(/\?/g, '\\?');
   // console.log('+', tableName, query);
   return knex.raw(query)
       //.on('query', data => console.log('Knex: ' + data.sql))
       .then(result => {
         //console.log( 'result', result.rows, result.rows[0]._id );
         return [ result.rows[0]._id ];
       });
       */
 }

function insertItem(knex, tableName, itemData) {
      const q = knex //this.model.save(this.vobj)
        .insert(itemData)
        .into(tableName)
        .returning('_id');
        
      //console.log('q', q.toString());
      return q; //.then(x => {console.log(x); return x; });
}

 function upsertItem(knex, tableName, itemData) {
  if( Array.isArray(itemData) ) {
    return Promise.map(itemData, i => {
      if(itemData._id) return _upsertItem(knex, tableName, i);
      else return insertItem(knex, tableName, i);
    });
  }
  else {
    if(itemData._id) return _upsertItem(knex, tableName, itemData);
    else return insertItem(knex, tableName, itemData);
  }
 }

 // stringify jsonb fields
function correctJsonFields(_schema, obj) {
  const r = _(obj)
    .pickBy((v, k) => !_schema.joins[k] && (_.isObject(v) || _.isArray(v)))
    //.pickBy((v, k) => _schema.props[k] && _schema.props[k].type === TYPE_JSONB)
    .mapValues(JSON.stringify)
    .value();

  // console.log("******corrected********", r);
  return _.merge(obj, r); //l->r
}

function removeInvalidFields(_schema, obj) {
  const r = _(obj)
    .pickBy((v, k) => k !== '_id' && !_schema.props[k] && !_schema.joins[k])
    .keys()
    .value();

  // console.log("******removed********", r);
  return _.omit(obj, ...r); //l->r
}

