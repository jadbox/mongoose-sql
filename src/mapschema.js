const _ = require("lodash");
const schema = require('./Schema');

module.exports = { getRelations, parse };

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

const ARRAY_OBJ_TYPE = typeMap[Object];
const isArrayType = x => Array.isArray(x) && x.length !== 0;

// Builds the name of the join table
const joinTableName(sourceTableName, fieldName) => 
    _.snakeCase(sourceTableName + ' ' + fieldName);

// returns an Array of associations
function getRelations(name, params) {
    const hasManyTypes = _(params)
      .pickBy(isArrayType)
      .pickBy(x => x[0].ref)
      .mapValues((x, field) => ({
        ref: x[0].ref,
        rel: "many",
        ltable: joinTableName(name, field)
      }))
      .value();

    // Find Has One relations to other objects
    const hasOneType = _(params)
      .pickBy(x => x.ref)
      .mapValues((x, field) => ({
        ref: x.ref,
        rel: "one",
        ltable: joinTableName(name, field)
      }))
      .value();

      return _.merge(hasManyTypes, hasOneType);
}

function parse(name, table) {
/*
    Person.jsonSchema = {
  type: 'object',
  required: ['firstName', 'lastName'],

  properties: {
    id: {type: 'integer'},
    parentId: {type: ['integer', 'null']},
    firstName: {type: 'string', minLength: 1, maxLength: 255},
    lastName: {type: 'string', minLength: 1, maxLength: 255},
    age: {type: 'number'},

    // Properties defined as objects or arrays are
    // automatically converted to JSON strings when
    // writing to database and back to objects and arrays
    // when reading from database. To override this
    // behaviour, you can override the
    // Person.jsonAttributes property.
    address: {
      type: 'object',
      properties: {
        street: {type: 'string'},
        city: {type: 'string'},
        zipCode: {type: 'string'}
      }
    }
  }
};
Person.relationMappings = 
{
  pets: {
    relation: Model.HasManyRelation,
    // The related model. This can be either a Model
    // subclass constructor or an absolute file path
    // to a module that exports one. We use the file
    // path version in this example to prevent require
    // loops.
    modelClass: __dirname + '/Animal',
    join: {
      from: 'Person.id',
      to: 'Animal.ownerId'
    }
  },
*/
    const params = this.def;

    // Translate mongoose field types to sql
    const vTypes = _(params)
      .pickBy(x => x.type && !x.ref)
      .mapValues((x, field) => ({
        properties: { [field]: { type: typeMap[x.type] } }
      }))
      .value();

    // PATCH: Convert fields that manually link fieds to Integer instead of FLOAT. Ex: Package.cptPackageId
    _(vTypes)
      .toPairs()
      .filter(([ k, v ]) => v.type === typeMap[Number] && k.indexOf("Id") > -1)
      .fromPairs()
      .mapValues(x => ({ type: typeMap.id }))
      .forEach((v, field) => vTypes.properties[field].type = v);

    // Default value conversion (non-collection)
    const vDefaults = _(params)
      .pickBy(x => x.default)
      .mapValues(x => {
        if (x.default === Date.now)
          return { notNullable: true, defaultTo: knex.fn.now() };
        else
          return { defaultTo: x.default };
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

    // Collections with schema ref
    const hasManyTypes = _(params)
      .pickBy(isArrayType)
      .pickBy(x => x[0].ref)
      .mapValues((x, field) => ({
        //relation: OModel.HasManyRelation,
        //modelClass: null,
        ref: x[0].ref,
        rel: "many",
        // for deps
        //join: {
        from: name + ".id",
        //'Animal.ownerId'
        //}
        to: x[0].ref + ".id"
      }))
      .value();

    // Find Has One relations to other objects
    const hasOneType = _(params)
      .pickBy(x => x.ref)
      .mapValues((x, field) => ({
        //relation: OModel.HasOneRelation,
        //modelClass: null,
        ref: x.ref,
        rel: "one",
        // for deps
        //join: {
        from: name + ".id",
        //'Animal.ownerId'
        //}
        to: x.ref + ".id"
      }))
      .value();

    // Defaults on array types
    const vADefaults = _(params)
      .pickBy(isArrayType)
      .pickBy(x => x[0].default)
      .mapValues(x => ({ defaultTo: x[0].default }))
      .value();

    // Lowercase restrictions on array types
    /*const vLowerCase = _(params)
      .pickBy(x => x.lowercase)
      .mapValues(x => ({validate: {isLowercase: true}}))
      .value();*/
    const v = _.merge(
      { type: "object" },
      vTypes,
      vATypes,
      vDefaults,
      vADefaults,
      vUnique,
      //,vLowerCase
      vRequired
    );
    const refs = _.merge(hasOneType, hasManyTypes);
    v.refs = refs;

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
    console.log("schema", v);
    throw new Error("0-");
    return v;
}