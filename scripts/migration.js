const _ = require("lodash");
const MONGO_CONNECTION = "mongodb://localhost/zps-dev";

const mongoose = require("mongoose");
//console.log(mongoose.Schema);
const common = require("../test/common");
let models = common.getModels();

const mapschema = require("../src/mapschema");
//const mongoose_sql = require('../src/index');
const Promise = require("bluebird").Promise;

mongoose.connect(MONGO_CONNECTION);
//const mongoose_proxy = require('./index');
function init() {
  /*
    const MPackage_Schema = new mongoose_proxy.Schema(models.Package);
    const MPackage = mongoose_proxy.model('Package', MPackage_Schema);

    const MSticker_Schema = new mongoose_proxy.Schema(models.Sticker)
    const MSticker = mongoose_proxy.model('Sticker', MSticker_Schema);

    const MCategory_Schema = new mongoose_proxy.Schema(models.Category);
    const MCategory = mongoose_proxy.model('Category', MCategory_Schema);
*/
  //const migrateTables = [stickerZ, categoryZ, packageZ];
  //models = { Package: models.Package }
  console.log("migrating", _.keys(models));
  const Schemas = _.mapValues(models, v => new mongoose.Schema(v));
  const Models = _.mapValues(Schemas, (v, k) => mongoose.model(k, v));

  const knex = common.initDB();

  const migrationTables = _.mapValues(models, (v, k) => {
    const ms = mapschema.parse(k, v, knex);
    ms.mongoose = Models[k];
    return ms;
  });

  /*
  const stickerZ = mapschema.parse("Sticker", models.Sticker, knex);
  stickerZ.mongoose = Sticker;
  const categoryZ = mapschema.parse("Category", models.Category, knex);
  categoryZ.mongoose = Category;
  const packageZ = mapschema.parse("Package", models.Package, knex);
  packageZ.mongoose = Package;
*/
  //const x1 = mapschema.parse("Sticker", models.Sticker, knex);

  const migrationModels = [ 
    'Category',
    'Sticker',
    'Package',
    'Cache',
    'LogLevel',
    'User',
    'Post',
    'Banner' ]; // order is key
  //_.values(migrationTables);

  console.log("syncing", migrationModels);

  Promise.map(migrationModels, 
      m => mapschema.sync(knex, migrationTables[m])
    )
    .then(migrate);

  function migrate() {
    console.log('sync completed');
    mapschema
      .migrateSchemas(knex, mongoose, _.values(migrationTables))
      .then(y => {
        console.log("completed");
      });
  }
}

init();
