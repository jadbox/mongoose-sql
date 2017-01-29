const _ = require("lodash");
const schema = require("./Schema");
const Promise = require("bluebird").Promise;

module.exports = {
  getRelations,
  parse,
  sync,
  find,
  findByID,
  create,
  migrateSchemas
  //migrateTable,
  //migrateTablePost
};

const TYPE_JSONB = "jsonb";
const typeMap = {
  [String]: "string",
  [Number]: "float",
  id: "integer",
  [Date]: "date",
  [Boolean]: "boolean",
  // untyped array
  [Array]: TYPE_JSONB,
  // untyped object
  [Object]: TYPE_JSONB
};

const ONE = "1", MANY = ">1";

const ARRAY_OBJ_TYPE = typeMap[Object];
const isArrayType = x => Array.isArray(x) && x.length !== 0;

// Builds the name of the join table
function joinTableName(sourceTableName, fieldName) {
  return _.snakeCase(tableName(sourceTableName) + " " + fieldName);
}

// Mongoose Model name to SQL table name
function tableName(sourceTableName) {
  return _.snakeCase(sourceTableName);
}

// returns an Array of associations
function getRelations(name, params) {
  const hasManyTypes = _(params)
    .pickBy(isArrayType)
    .pickBy(x => x[0].ref)
    .mapValues((x, field) => ({
      //type: 'ref',
      ref: x[0].ref,
      refTable: tableName(x[0].ref),
      rel: MANY,
      ltable: joinTableName(name, field)
    }))
    .value();

  // Find Has One relations to other objects
  const hasOneType = _(params)
    .pickBy(x => x.ref)
    .mapValues((x, field) => ({
      //type: 'ref',
      ref: x.ref,
      refTable: tableName(x.ref),
      rel: ONE
    }))
    .value();

  return [ hasOneType, hasManyTypes ];
}

// Makes a clean internal representation to consume
function parse(name, params, knex) {
  // check if knex ref is provided, otherwise no-op
  const knexNow = knex ? knex.fn.now.bind(knex.fn) : x => "";
  // Translate mongoose field types to sql
  const vTypes = _(params)
    .pickBy(x => x.type && !x.ref)
    .mapValues((x, field) => ({ type: typeMap[x.type] }))
    .value();

  // PATCH: Convert fields that manually link fieds to Integer instead of FLOAT. Ex: Package.cptPackageId
  const isIntProp = k => {
    if (!k) throw new Error("invalid key");
    return k.indexOf("Id") > 2 || k.indexOf("priority") !== -1;
  };
  _(vTypes)
    .pickBy((v, k) => v.type === typeMap[Number] && isIntProp(k))
    .mapValues(x => typeMap.id)
    .forEach((v, field) => {
      //console.log(name + ':' + field + ' overriding ', vTypes[field].type + ' to ' + v);
      vTypes[field].type = v;
    });

  // Default value conversion (non-collection)
  const vDefaults = _(params)
    .pickBy(x => x.default)
    .mapValues(x => {
      if (x.default === Date.now)
        return { notNullable: true, default: knexNow() };
      else
        return { default: x.default };
    })
    .value();

  // Get Unique field parameters
  const vUnique = _(params)
    .pickBy(x => x.unique)
    .mapValues(x => ({ unique: x.unique }))
    .value();

  // Get Required field parameters
  // TODO bug with validate
  const vRequired = _(params)
    .pickBy(x => x.required)
    .mapValues(x => ({}))
    .value();
  // , validate: { notNull: true, notEmpty: true }
  // Collections without schema ref
  const vATypes = _(params)
    .pickBy(isArrayType)
    .pickBy(x => !x[0].ref)
    .mapValues(x => ({ type: ARRAY_OBJ_TYPE }))
    .value();

  // Defaults on array types
  const vADefaults = _(params)
    .pickBy(isArrayType)
    .pickBy(x => x[0].default)
    .mapValues(x => ({ default: x[0].default }))
    .value();

  // Lowercase restrictions on array types
  /*const vLowerCase = _(params)
      .pickBy(x => x.lowercase)
      .mapValues(x => ({validate: {isLowercase: true}}))
      .value();*/
  const refs = getRelations(name, params);
  const v = {};

  v.props = _.merge(
    vTypes,
    vATypes,
    vDefaults,
    vADefaults,
    vUnique,
    //,vLowerCase
    vRequired,
    refs[0]
  );

  // Don't use SQL snakecase in order to preserve field names used by client
  //v.props = _(v.props).toPairs().map( ([x, y])=>[_.snakeCase(x),y]).fromPairs().value();;
  v.fields = _.keys(v.props);
  v.fields.push("_id");

  v.refs = _.concat(..._.map(refs, _.keys));
  v.joins = refs[1];
  v.table = tableName(name);
  v.name = name;
  v.idField = v.table + "._id";

  //v.refs = refs;
  //v.increments = 'id'.primary();
  /*
    v.uid = {
      type: Sequelize.INTEGER,
      primaryKey: true,
      // Automatically gets converted to SERIAL for postgres
      autoIncrement: true
    };
    v.id = {type: Sequelize.STRING};
    */
  //console.log("schema", v);
  //throw new Error("0-");
  return v;
}

function sync(knex, _schema) {
  let r = knex.schema.createTableIfNotExists(_schema.table, function(table) {
    table.string("__id");
    // old ID
    table.increments("_id");
    _.forEach(_schema.props, (v, k) => {
      //console.log('-', k);
      let z;
      if (v.type === "string") z = table.text(k);
      else if (v.type === "boolean") z = table.boolean(k);
      else if (v.type === "float") z = table.float(k);
      else if (v.type === "integer") z = table.integer(k);
      else if (v.type === "date") {
        z = table.timestamp(k).defaultTo(knex.fn.now());
      } else if (v.type === "jsonb") z = table.jsonb(k);
      else if (v.type === "id") z = table.integer(k).unsigned();
      else if (v.ref) {
        z = table.integer(k).unsigned();
        table.foreign(k).references(v.refTable + "._id");
      }
      if (!z) {
        console.warn(_schema.table + ": lacks type for prop " + v.type);
        return;
      }

      if (v.defaut) z = z.defaultTo(v.default);
      if (v.notNullable) z = z.notNullable();
    });
  });

  _.forEach(_schema.joins, (v, k) => {
    console.log("v.ltable", v.ltable);
    r = r.createTableIfNotExists(v.ltable, function(table) {
      //table.increments("_id"); no id needed
      table.integer(_schema.table).unsigned().index();
      table.foreign(_schema.table).references(_schema.table + "._id");

      table.integer(k).unsigned();
      // opt: .index()
      table.foreign(k).references(v.refTable + "._id");
      table.primary([ _schema.table, k ]); // forced unique
    });
  });

  return r;
}

// find with all populate
function find(knex, _schema) {
  let q = knex.select().from(_schema.table);

  _.forEach(_schema.joins, (v, k) => {
    q = q.leftOuterJoin(
      v.ltable,
      _schema.idField,
      v.ltable + "." + _schema.table
    );
  });

  return q;
}

// find with all populate by ID
function findByID(knex, _schema, id) {
  const q = find(knex, _schema);
  return q.where("_id", id);
}

// Create an entry with associations
function create(knex, _schema, obj) {
  if (obj.recommendedPackages) {
    //console.log('_schema.joins', _schema.joins, _.keys(obj));
    console.log(_(obj).pickBy((v, k) => _schema.joins[k]).value());
    //return;
  }

  const filtered = removeInvalidKeys(_schema, obj);
  const jsonbFixed = correctJsonFields(_schema, filtered);

  //console.log(_schema.table + " saving ");
  // + JSON.stringify(jsonbFixed));
  let query = knex(_schema.table).insert(jsonbFixed).returning("_id");

  // associations
  _(obj)
    .pickBy((v, k) => _schema.joins[k])
    .mapValues((v, k) => {
      const vo = _schema.joins[k];
      console.log("---------saving into ", vo.ltable, vo.refTable);
      _.forEach(v, vid => {
        query = query.then(
          // return row id
          ids =>
            knex(vo.ltable)
              .insert({ [vo.refTable]: ids[0], [k]: vid })
              .then(x => ids)
        );
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
  const w = _.without(_.keys(obj), "__id", ..._schema.fields);
  if (w.length > 0) console.log(_schema.table + " removed fields", w);
  // take only valid fields
  return filtered = _.omit(obj, "__v", ...w);
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

  _.map(
    _schema.refs,
    // map over schema refs
    field => _.map(objs, // extract fields
    o => {
      //console.log('=======k', field);
      //process.exit(1);
      const val = o[field];
      if (!val) return;
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
    })
  );

  const filtered = _.map(objs, _removeInvalidKeys);
  const jsonbFixed = _.map(filtered, _correctJsonFields);

  console.log(_schema.table + " saving " + jsonbFixed.length + " rows");
  console.log();
  let query = Promise.all(
    _.map(jsonbFixed, o => {
      return knex(_schema.table)
        .insert(o)
        .returning([ "_id", "__id" ])
        .then(x => x); //toPromise
    })
  ).then(results => {
    // save id map
    _.forEach(results, ([ { _id, __id } ]) => idMap[__id] = _id);
    console.log(_schema.table, "idMap", idMap);
    return results;
  });

  return query;
}

// Saves associations
function migrateTablePost(knex) {
  const todoMap = _.map(_.cloneDeep(todo), e => {
    e.id = idMap[e.id];
    if (!e.id) throw new Error("inconsistent id record", e.id);
    // direct relationships
    if (!e.refTable) {
      e.val = idMap[e.val];
      if (!e.val) {
        console.warn(e);
        throw new Error("Ref inconsistent record " + e.val);
      }
    } else e.val = _.map(e.val, val => {
        // one relationship
        const id = idMap[val];
        if (!id) console.warn("RefList inconsistent record " + val);
        return id;
      });
    return e;
  });

  // todo many to many
  const ps = _.map(todoMap, e => {
    //const _schema = schemaMap[e.table];
    if (!e.refTable) {
      return knex(e.table)
        .where("_id", e.id)
        .update(e.field, e.val)
        .returning("_id")
        .then(x => x);
    } else {
      // save associations
      return Promise.map(
        e.val,
        val =>
          knex(e.ltable)
            .insert({ [e.field]: val, [e.table]: e.id })
            .returning([ [ e.field ], [ e.table ] ])
            .then(x => x)
      );
    }
  });

  return Promise.all(ps);
}

function migrateSchemas(knex, schemas) {
  return Promise.mapSeries(migrateTables, migrateSchema).then(y => {
    console.log("non-relational schemas migrated")
    mapschema.migrateTablePost(knex).then(x=>
      console.log("all schemas migrated")
    );
  });
}

function migrateSchema(knex, Base) {
  console.log("migrating", Base.table);
  return new Promise(function(resolve, reject) {
    Base.mongoose.find().exec((e, x) => {
      if (x.length === undefined) throw new Error("no length");
      migrateTable(knex, Base, x).then(x => {
        console.log(Base.table + " migrated");
        resolve("done");
      });
    });
  });
}
