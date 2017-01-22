// Simple mongoose test
// TODO: refactor to unit test
var assert = require("chai").assert;

const mp = require("../src/index.js");
const Schema = mp.Schema;
const Models = require("./models").init(Schema);

const mapschema = require("../src/mapschema");

describe("test", function() {
  it("finds relative tables", function(d) {
    const x = mapschema.getRelations("Package", Models.Package);
    console.log(x);

    assert.deepEqual(x, {
      recommendedPackages: {
        ref: "Package",
        rel: "many",
        ltable: "package_recommended_packages"
      },
      featureSticker: {
        ref: "Sticker",
        rel: "one",
        ltable: "package_feature_sticker"
      },
      category: {ref: "Category", rel: "one", ltable: "package_category"}
    });
    d();
  });
});
/*
PackageSchema = new Schema(Models.Package)

Package = mp.model('Package', PackageSchema)

// Category
CategorySchema = new Schema(Models.Category);

Category = mp.model('Category', CategorySchema);

// Sticker Model

StickerSchema = new Schema(Models.Sticker);

mp.model('Sticker', StickerSchema);
*/
