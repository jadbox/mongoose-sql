// Simple mongoose test
// TODO: refactor to unit test
var assert = require("chai").assert;

const mp = require("../src/index.js");
const Schema = mp.Schema;
const Models = require("./models").init(Schema);

const mapschema = require("../src/mapschema");

describe("utils", function() {
  let knex = require('knex')({client: 'pg'});

  it("finds relative tables", function(d) {
    const x = mapschema.getRelations("Package", Models.Package);
    //console.log(x);
    assert.deepEqual(x, [
      {
        category: {ref: "Category", rel: "1",  refTable: "category",},
        featureSticker: {
          ref: "Sticker",
          refTable: "sticker",
          rel: "1"
        }
      },
      {
        recommendedPackages: {
          ref: "Package",
          refTable: "package",
          rel: ">1",
          ltable: "package_recommended_packages"
        }
      }
    ]);
    d();
  });

  // ====================
  it("finds relative tables", function(d) {
    const x = mapschema.parse("Package", Models.Package, knex);
    console.log("parse\n", x);
    const y = mapschema.sync(knex, x).toString();
    console.log("sync\n", y);
    d()
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
