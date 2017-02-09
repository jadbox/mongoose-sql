const _ = require("lodash");
const mongoose = require("mongoose");
const mapschema = require("../src/mapschema");
const Promise = require("q").Promise;

const TYPE_JSONB = 'jsonb';

function migrate(knex, mongoose, models, ModelDefs, migrationModels) {

  const migrationTables = _.mapValues(models, (v, k) => {
    const ms = mapschema.parse(k, v, knex);
    ms.mongoose = ModelDefs[k];
    return ms;
  });
  const migrationTablesSorted = _.map(migrationModels, m => migrationTables[m]);

  console.log("syncing", migrationModels);

  // create tables
  return Promise.all(
    _.map(migrationModels, m => mapschema.sync(knex, migrationTables[m]))
  ).then(() => {
    // migrate data
    console.log("sync completed: tables created");
    return migrateSchemas(knex, mongoose, migrationTablesSorted).then(y => {
      console.log("migrated data");
    });
  }).catch(e => console.log('error: ' + e));
}

module.exports = { migrate, migrateSchemas };

// Create an entry with associations
function create(knex, _schema, obj) {
  if (obj.recommendedPackages) {
    //console.log('_schema.joins', _schema.joins, _.keys(obj));
    console.log(_(obj).pickBy((v, k) => _schema.joins[k]).value());
    //return;
  }

  const filtered = removeInvalidKeys(_schema, obj);
  const jsonbFixed = correctJsonFields(_schema, filtered);

  // + JSON.stringify(jsonbFixed));
  let query = knex(_schema.table).insert(jsonbFixed).returning('_id');

  // associations
  _(obj)
    .pickBy((v, k) => _schema.joins[k])
    .mapValues((v, k) => {
      const vo = _schema.joins[k];
      console.log('---------saving into ', vo.ltable, vo.refTable);
      _.forEach(v, vid => {
        query = query.then(ids => // return row id
          knex(vo.ltable)
            .insert({ [vo.refTable]: ids[0], [k]: vid })
            .then(x => ids));
      });
    })
    .value();

  return query;
}

// ===== migrateTable helpers =====
// stringify jsonb fields
function correctJsonFields(_schema, obj) {
  const r = _(obj)
    .pickBy((v, k) => _schema.props[k] && _schema.props[k].type === TYPE_JSONB)
    .mapValues(JSON.stringify)
    .value();

  return _.merge(obj, r); //l->r
}

function removeInvalidKeys(_schema, obj) {
  const w = _.without(_.keys(obj), '__id', ..._schema.fields);

  // warning on non-matching field
  if (w.length > 1 && !_schema.fieldWarning) {
    console.log(_schema.table + ' removed fields', _.without(w, '__v'));
    _schema.fieldWarning = true;
  }

  // take only valid fields
  return filtered = _.omit(obj, '__v', ...w);
}

// Move Mongo's _id field to __id
function moveIDKey(obj) {
  // in-place op
  //if (typeof obj._id === 'object' || typeof obj._id === 'string') {
  obj.__id = obj._id.toString();
  delete obj._id;
  // }
  return obj;
}

// Cheating global state that persist over several table migrations
const idMap = {}, todo = [];
//batchInsert
function migrateTable(knex, _schema, objs) {
  const _removeInvalidKeys = removeInvalidKeys.bind(null, _schema),
    _correctJsonFields = correctJsonFields.bind(null, _schema);

  objs = _.map(objs, x => x.toObject ? x.toObject() : x);

  //schemaMap[_schema.table] = _schema;
  objs = _.map(objs, v => moveIDKey(v));

  _.map(_schema.refs, field => _.map(objs, o => {
    // map over schema refs // extract fields
    //console.log('=======k', field);
    //process.exit(1);
    const val = o[field];
    if (!val && val !== 0) return;
    if (_.isObject(val) || _.isArray(val))
      if (val.length && val.length === 0) return;

    delete o[field];

    // removed from insert
    let todoItem = { field, id: o.__id, val, table: _schema.table };

    // save association table for many to many
    if (_schema.joins[field]) {
      todoItem = _.merge(todoItem, {
        refTable: _schema.joins[field].refTable,
        ltable: _schema.joins[field].ltable
      });
    }
    todo.push(todoItem);
  }));

  const filtered = _.map(objs, _removeInvalidKeys);
  const jsonbFixed = _.map(filtered, _correctJsonFields);

  console.log(_schema.table + ' saving ' + jsonbFixed.length + ' rows');
  console.log();
  let query = Promise.all(
    _.map(jsonbFixed, o => {
      return knex(_schema.table)
        .insert(o)
        .returning(['_id', '__id'])
        .then(x => x); //toPromise
    })
  ).then(results => {
    // save id map
    _.forEach(results, ([{ _id, __id }]) => idMap[__id] = _id);
    return results;
  });

  return query;
}

// Saves associations
function migrateTablePost(knex) {
  const todoMap = _.map(_.cloneDeep(todo), e => {
    e.id = idMap[e.id];
    if (!e.id) throw new Error('inconsistent id record', e.id);

    // direct relationships id mapping
    if (!e.refTable) {
      e.val = idMap[e.val];
      if (!e.val) {
        console.warn(e);
        throw new Error('Ref inconsistent record ' + e.val);
      }
    } else {
      // non-direct many-many relationships id mapping
      e.val = _(e.val)
        .map(val => {
          // one relationship
          const id = idMap[val];
          if (!id) console.warn('RefList inconsistent record ' + val);
          return id || null;
        })
        .filter(null)
        .value();
    }
    return e;
  });

  // todo many to many
  const ps = _.map(todoMap, e => {
    //const _schema = schemaMap[e.table];
    if (!e.refTable) {
      return knex(e.table)
        .where('_id', e.id)
        .update(e.field, e.val)
        .returning('_id')
        .then(x => x);
    } else {
      // save associations
      return Promise.all(_.map(e.val, val => {
        return knex(e.ltable)
          .insert({ [e.field]: val, [e.table]: e.id })
          .returning([[e.field], [e.table]])
          .then(x => x);
      }));
    }
  });

  return Promise.all(ps);
}

// parse(name, params, knex) {
function migrateSchemas(knex, mongoose, schemas) {
  const _migrateSchema = migrateSchema.bind(null, knex, mongoose);

  let q = _.reduce(schemas, (qq, s) => {
    return qq.then(() => _migrateSchema(s));
  }, Promise.resolve());

  q = q.then(y => {
    console.log('non-relational schemas migrated');
    return migrateTablePost(knex).then(x => console.log('all schemas migrated'));
  });
  return q;
}

// TODO cleanup: move to migration
function migrateSchema(knex, mongoose, Base) {
  console.log('migrating', Base.table);
  return Promise.resolve().then(() => Base.mongoose.find().exec()).then(x => {
    console.log('fetched all', Base.table);
      /*if(Base.table.indexOf('ackage') > -1) {
        console.log('catching Package');
        _(x).filter(y=>y.pkgStatsVisibility)
          .map(y=>console.log(y)).value();
        return;
      }*/
      //console.log(Base.table, x);

      if (!x || !x.length) throw new Error('no length on ' + x);
      return migrateTable(knex, Base, x).then(x1 => {
        if (!x) x = [];
        console.log(Base.table + ' migrated rows ' + x.length);
        //resolve('done');
      });
    });

}
