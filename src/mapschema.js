const _ = require('lodash');
const schema = require('./Schema');
const Promise = require('q').Promise;

module.exports = {
  getRelations,
  parse,
  sync,
  find,
  findByID
};

const TYPE_JSONB = 'jsonb';
const typeMap = {
  [String]: 'string',
  [Number]: 'float',
  id: 'integer',
  [Date]: 'date',
  [Boolean]: 'boolean',
  // untyped array
  [Array]: TYPE_JSONB,
  // untyped object
  [Object]: TYPE_JSONB
};

const ONE = '1', MANY = '>1';

const ARRAY_OBJ_TYPE = typeMap[Array];
const isArrayType = x => Array.isArray(x) && x.length !== 0;

// Builds the name of the join table
function joinTableName(sourceTableName, fieldName) {
  return _.snakeCase(tableName(sourceTableName) + ' ' + fieldName);
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

  return [hasOneType, hasManyTypes];
}

// Makes a clean internal representation to consume
function parse(name, params, knex) {
  // check if knex ref is provided, otherwise no-op
  const knexNow = knex ? knex.fn.now.bind(knex.fn) : x => '';

  // Translate mongoose field types to sql
  const vTypes = _(params)
    .pickBy(x => x.type && !x.ref)
    .mapValues((x, field) => ({ type: typeMap[x.type] }))
    .value();

  // Nested value objects
  const vTypesObj = _(params)
    .pickBy(x => !x.type && !x.ref && !x.length && _.keys(x).length > 0)
    .mapValues((x, field) => ({ type: typeMap[Object] }))
    .value();

  // PATCH: Convert fields that manually link fieds to Integer instead of FLOAT. Ex: Package.cptPackageId
  const isIntProp = k => {
    if (!k) throw new Error('invalid key');
    return k.indexOf('Id') > 2 || k.indexOf('priority') !== -1;
  };
  _(vTypes)
    .pickBy((v, k) => v.type === typeMap[Number] && isIntProp(k))
    .mapValues(x => typeMap.id)
    .forEach((v, field) => {
      vTypes[field].type = v;
    });

  // Default value conversion (non-collection)
  const vDefaults = _(params)
    .pickBy(x => x.default)
    .mapValues(x => {
      if (x.default === Date.now)
        return { notNullable: true, default: knexNow() };
      else
        return { notNullable: true, default: x.default };
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
    .mapValues(x => ({ required: x.required }))
    .value();
    
  // , validate: { notNull: true, notEmpty: true }
  // Collections without schema ref
  const vATypes = _(params)
    .pickBy(isArrayType)
    .pickBy(x => !x[0].ref)
    .mapValues(x => ({ type: ARRAY_OBJ_TYPE, notNullable: true, default: '[]' }))
    .value();

  // Defaults on array types
  const vADefaults = _(params)
    .pickBy(isArrayType)
    .pickBy(x => x[0].default)
    .mapValues(x => ({ default: x[0].default }))
    .value();

  const refs = getRelations(name, params);
  const v = {};

  v.props = _.merge(
    vTypes,
    vTypesObj,
    vATypes,
    vDefaults,
    vADefaults,
    vUnique,
    //,vLowerCase
    vRequired,
    refs[0]
  );

  // Don't use SQL snakecase in order to preserve field names used by client
  //v.props = _(v.props).toPairs().map( ([x, y])=>[_.snakeCase(x),y]).fromPairs().value();
  v.fields = _.keys(v.props);
  v.fields.push('_id');

  v.refs = _.concat(..._.map(refs, _.keys));
  v.joins = refs[1];
  v.table = tableName(name);
  v.name = name;
  v.idField = v.table + '._id';
  return v;
}

function sync(knex, _schema) {
  // check if table already exists
  // TODO: cleanup
  let r = knex.schema.hasTable(_schema.table).then(function(exists) {
    if (exists) return null;

    let r2 = knex.schema.createTableIfNotExists(_schema.table, function(table) {
      table.string('__id');
      // old ID
      table.increments('_id');
      _.forEach(_schema.props, (v, k) => {
        //console.log('-', k);
        let z;
        if (v.type === 'string')
          z = table.text(k);
        else if (v.type === 'boolean')
          z = table.boolean(k);
        else if (v.type === 'float')
          z = table.float(k);
        else if (v.type === 'integer')
          z = table.integer(k);
        else if (v.type === 'date') {
          z = table.timestamp(k).defaultTo(knex.fn.now());
        } else if (v.type === 'jsonb')
          z = table.jsonb(k);
        else if (v.type === 'id')
          z = table.integer(k).unsigned();
        else if (v.ref) {
          z = table.integer(k).unsigned();
          table.foreign(k).references(v.refTable + '._id').onDelete('SET NULL');
        }
        if (!z) {
          console.warn(_schema.table + ': lacks type for prop ' + v.type);
          return;
        }
        if (v.unique) z = z.unique();
        if (v.required || v.notNullable) z = z.notNullable();
        if (v.default) z = z.defaultTo(v.default);
      });
    });

    _.forEach(_schema.joins, (v, k) => {
      //console.log("v.ltable", v.ltable);
      r2 = r2.createTableIfNotExists(v.ltable, function(table) {
        //table.increments("_id"); no id needed
        table.integer(_schema.table).unsigned().index();
        table
          .foreign(_schema.table)
          .references(_schema.table + '._id')
          .onDelete('CASCADE');

        table.integer(k).unsigned();
        // opt: .index()
        table.foreign(k).references(v.refTable + '._id').onDelete('CASCADE');
        table.primary([_schema.table, k]); // forced unique
      });
    });

    return r2;
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
      v.ltable + '.' + _schema.table
    );
  });

  return q;
}

// find with all populate by ID
function findByID(knex, _schema, id) {
  const q = find(knex, _schema);
  return q.where('_id', id);
}
