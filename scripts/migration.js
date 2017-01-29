const _ = require("lodash");
const MONGO_CONNECTION = "mongodb://localhost/zps-dev";

const mongoose = require("mongoose");
//console.log(mongoose.Schema);
const common = require("../test/common");
const models = common.getModels(mongoose.Schema);
const mapschema = require("../src/mapschema");
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
  const Package_Schema = new mongoose.Schema(models.Package);
  const Package = mongoose.model("Package", Package_Schema);

  const Sticker_Schema = new mongoose.Schema(models.Sticker);
  const Sticker = mongoose.model("Sticker", Sticker_Schema);

  const Category_Schema = new mongoose.Schema(models.Category);
  const Category = mongoose.model("Category", Category_Schema);

  const knex = common.initDB();
  const stickerZ = mapschema.parse("Sticker", models.Sticker, knex);
  stickerZ.mongoose = Sticker;
  const categoryZ = mapschema.parse("Category", models.Category, knex);
  categoryZ.mongoose = Category;
  const packageZ = mapschema.parse("Package", models.Package, knex);
  packageZ.mongoose = Package;
  //const x1 = mapschema.parse("Sticker", models.Sticker, knex);
  let uuid = {};

  const migrateTables = [stickerZ, categoryZ, packageZ];

  mapschema.migrateSchemas(migrateTables).then(y => {
    console.log("completed");
  });
}

init();
