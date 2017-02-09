const _ = require('lodash');
const MONGO_CONNECTION = 'mongodb://localhost/zps-dev';

const mongoose = require('mongoose');
const common = require('../test/common');
let models = common.getModels();

const migrate = require('../src/index').migrate;

const Promise = require('q').Promise;

mongoose.connect(MONGO_CONNECTION);
mongoose.Promise = require('q').Promise;

function init() {
  /*
    const MPackage_Schema = new mongoose_proxy.Schema(models.Package);
    const MPackage = mongoose_proxy.model('Package', MPackage_Schema);
  */
  const Schemas = _.mapValues(models, v => new mongoose.Schema(v));

  // Note: Mongoose Models are non-transparent and cannot be used to migrate
  const ModelDefs = _.mapValues(Schemas, (v, k) => mongoose.model(k, v));

  const knex = common.initDB();

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

  migrate(knex, mongoose, models, ModelDefs, migrationModels).then(x => {
    console.log('all completed');
  });
}

init();
