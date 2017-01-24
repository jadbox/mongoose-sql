// Simple mongoose test
// TODO: refactor to unit test
const assert = require("chai").assert;
const Promise = require('bluebird');

const mp = require("../src/index.js");
const Schema = mp.Schema;
const Models = require("./models").init(Schema);

const mapschema = require("../src/mapschema");

const localPG = {
  client: "pg",
  connection: {
    user: "jonathan.dunlap",
    database: "test",
    port: 5432,
    host: "localhost",
    password: ""
  },
  debug: false,
  pool: { min: 1, max: 2 }
};

const noPG = { client: "pg" };

const connectionParams = localPG;

//localPG noPG
describe("utils", function() {
  let knex = require("knex")(connectionParams);

  it("finds relative tables", function(d) {
    const x = mapschema.getRelations("Package", Models.Package);
    //console.log(x);
    assert.deepEqual(x, [
      {
        category: { ref: "Category", rel: "1", refTable: "category" },
        featureSticker: { ref: "Sticker", refTable: "sticker", rel: "1" }
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
  it("creates internal schema representation", function(d) {
    console.log("-");
    const x = mapschema.parse("Package", Models.Package, knex);
    const x1 = mapschema.parse("Sticker", Models.Sticker, knex);
    const x2 = mapschema.parse("Category", Models.Category, knex);
    console.log("parse\n", x);
    const y = mapschema.sync(knex, x);
    const y1 = mapschema.sync(knex, x1);
    const y2 = mapschema.sync(knex, x2);
    const yS = y.toString();
    console.log("sync\n", yS);
    //Promise.all([y1, y2, y], x=> {   
    //});
    y1.then(x => {
      console.log("1 sync done", JSON.stringify(x));
      y2.then(x => {
        console.log("2 sync done", JSON.stringify(x));
        y.then(x => {
        console.log("0 sync done", JSON.stringify(x));
        d();
        });
      });
    });
  });
  /*
  // ====================
  it("query all", function(d) {
    console.log("-");
    const x = mapschema.parse("Package", Models.Package, knex);
    //console.log("parse\n", x);
    const y = mapschema.find(knex, x)
    const y1 = y.toString();
    console.log("find\n", y1);
    y.then(x=>{
      console.log('done', JSON.stringify(x));
      d();
    });
    
  });

  it("query by id", function(d) {
    console.log("-");
    const x = mapschema.parse("Package", Models.Package, knex);
    //console.log("parse\n", x);
    const y = mapschema.findByID(knex, x, 0).toString();
    console.log("findByID\n", y);
    d()
  });

  // ====================
  it("create", function(d) {
    console.log("-");
    const x = mapschema.parse("Package", Models.Package, knex);
    //console.log("parse\n", x);
    const obj = {name: 123, bar:666, "_id": 1};
    const y = mapschema.create(knex, x, obj).toString();
    console.log("create\n", y);
    d()
  });*/
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
