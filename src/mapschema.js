const _ = require("lodash");
const schema = require("./Schema");

module.exports = { getRelations, parse, sync, find, findByID, create };

const typeMap = {
  [String]: "string",
  [Number]: "float",
  id: "integer",
  [Date]: "date",
  [Boolean]: "boolean",
  // untyped array
  [Array]: "jsonb",
  // untyped object
  [Object]: "jsonb"
};

const ONE = "1", MANY = ">1";

const ARRAY_OBJ_TYPE = typeMap[Object];
const isArrayType = x => Array.isArray(x) && x.length !== 0;

// Builds the name of the join table
function joinTableName(sourceTableName, fieldName) {
  return _.snakeCase( tableName(sourceTableName) + " " + fieldName);
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
  // Translate mongoose field types to sql
  const vTypes = _(params)
    .pickBy(x => x.type && !x.ref)
    .mapValues((x, field) => ({
      type: typeMap[x.type]
    }))
    .value();

  // PATCH: Convert fields that manually link fieds to Integer instead of FLOAT. Ex: Package.cptPackageId
  _(vTypes)
    .toPairs()
    .filter(([ k, v ]) => v.type === typeMap[Number] && k.indexOf("Id") > -1)
    .fromPairs()
    .mapValues(x => ({ type: typeMap.id }))
    .forEach((v, field) => vTypes[field].type = v);

  // Default value conversion (non-collection)
  const vDefaults = _(params)
    .pickBy(x => x.default)
    .mapValues(x => {
      if (x.default === Date.now)
        return { notNullable: true, default: knex ? knex.fn.now() : '' };
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
    { type: "object" },
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
  v.fields.push('_id');

  v.joins = refs[1];
  v.table = tableName(name);
  v.name = name;
  v.idField = v.table+'._id';
  
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
    let r = knex.schema.createTableIfNotExists(_schema.table, function (table) {
        table.increments('_id');
        _.forEach(_schema.props, (v,k) => {
           // console.log('-', v);
            let z;
            if(v.type==="string") z = table.text(k);
            else if(v.type==="float") z = table.float(k);
            else if(v.type==="date") z = table.timestamps(k);
            else if(v.type==="jsonb") z = table.jsonb(k);
            else if(v.type==="id") z = table.integer(k).unsigned();
            else if(v.ref) {
                table.integer(k).unsigned()
                table.foreign(k).references(v.refTable+'._id');
            }
            // todo foreign key link
        });
    });

     _.forEach(_schema.joins, (v,k) => {
         console.log('v.ltable', v.ltable)
         r = r.createTableIfNotExists(v.ltable, function (table) {
             table.increments('_id');

            table.integer(_schema.table).unsigned();
            table.foreign(_schema.table).references(_schema.table+'._id');

            table.integer(k).unsigned();
            table.foreign(k).references(v.refTable+'._id');
         });
     });

    return r;
}

function find(knex, _schema) {
    let q = knex.select().from(_schema.table);
    
    _.forEach(_schema.joins, (v,k) => {
        q = q.leftOuterJoin(v.ltable, _schema.idField, v.ltable + '.' + _schema.table);
    });

    return q;
}

function findByID(knex, _schema, id) {
    const q = find(knex, _schema);
    return q.where('_id', id);
}

function create(knex, _schema, obj) {
    const w = _.without(_.keys(obj), ..._schema.fields);
    console.log(_schema.table + ' removed fields', w)
    // take only valid fields
    const filtered = _.omit(obj, ...w);
    return knex(_schema.table).insert(filtered);
}