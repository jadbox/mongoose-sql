const _ = require('lodash');
const MONGO_CONNECTION = 'mongodb://localhost/zps-dev';

const mongoose = require('mongoose');
//console.log(mongoose.Schema);
const common = require('../test/common');
let models = common.getModels();

const mapschema = require('../src/mapschema');
//const mongoose_sql = require('../src/index');
const Promise = require('q').Promise;

mongoose.connect(MONGO_CONNECTION);
mongoose.Promise = require('q').Promise;
//const mongoose_proxy = require('./index');
function init() {
  /*
    const MPackage_Schema = new mongoose_proxy.Schema(models.Package);
    const MPackage = mongoose_proxy.model('Package', MPackage_Schema);
  */
  const Schemas = _.mapValues(models, v => new mongoose.Schema(v));

  // Note: Mongoose Models are non-transparent and cannot be used to migrate
  const Models = _.mapValues(Schemas, (v, k) => mongoose.model(k, v));

  const knex = common.initDB();

  const migrationTables = _.mapValues(models, (v, k) => {
    const ms = mapschema.parse(k, v, knex);
    ms.mongoose = Models[k];
    return ms;
  });

  /*
    const packageZ = mapschema.parse('Package', models.Package, knex);
    packageZ.mongoose = Package;
  */

  // must be ordered by dependencies
  const migrationModels = [
    'Category',
    'Sticker',
    'Package',
    'Cache',
    'LogLevel',
    'User',
    'Post',
    'Banner'
  ]; // order is key
  const migrationTablesSorted = _.map(migrationModels, m => migrationTables[m]);

  console.log('syncing', migrationModels);

  Promise.all(
      _.map(migrationModels, m => mapschema.sync(knex, migrationTables[m]))
    )
    .then(migrate);

  function migrate() {
    console.log('sync completed');
    mapschema.migrateSchemas(knex, mongoose, migrationTablesSorted).then(y => {
      console.log('completed');
    });
  }
}

init();
