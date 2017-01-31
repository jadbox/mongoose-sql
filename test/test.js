// Simple mongoose test
// TODO: refactor to unit test
const assert = require("chai").assert;
const Promise = require("bluebird");
const _ = require("lodash");

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
let knex;
describe("utils", function() {
  knex = require("knex")(connectionParams);

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
  /* TODO Migration tests
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
  */
  /*
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

describe("Mongoose API", function() {
  const PackageSchema = new Schema(Models.Package);
  const Package = mp.model("Package", PackageSchema);

  const CategorySchema = new Schema(Models.Category);
  const Category = mp.model("Category", CategorySchema);

  const StickerSchema = new Schema(Models.Sticker);
  const Sticker = mp.model("Sticker", StickerSchema);

  it("find", function(d) {
    Sticker.find().exec((e, x) => {
      console.log("found find", x.length);
      assert(x.length > 0);
      //assert.ok(e);
      d();
    });
  });

  it("find Sorted", function(d) {
    Sticker.find().sort("label").exec((e, x) => {
      //console.log('Sorted find', x).length;
      assert(x.length > 0);
      assert(
        _.reduce(
          x,
          (acc, i) => {
            assert(i.label > acc);
            return i.label;
          },
          ""
        )
      );
      //assert.ok(e);
      d();
    });
  });

  let createdID = -1;
  it("create", function(d) {
    const s = new Sticker({ label: "test123" });
    s.save((e, x) => {
      //console.log('create', x);
      createdID = x;
      assert(!!x);
      assert(e === null);
      //assert.ok(e);
      d();
    });
  });

  it("findByID", function(d) {
    Sticker.findByID(createdID).exec((e, x) => {
      //console.log('found findByID', x);
      assert(x._id === createdID);
      assert(x.created);
      assert(x.label);
      //assert.ok(e);
      d();
    });
  });

  it("findByID using string id", function(d) {
    Sticker.findByID('' + createdID.toString()).exec((e, x) => {
      assert(x._id === createdID);
      assert(x.label);
      d();
    });
  });

  it("findOne", function(d) {
    Sticker.findOne({ label: "test123" }).exec((e, x) => {
      //console.log('found findOne', x);
      assert(x._id === createdID);
      assert(x.created);
      assert(x.label);
      //assert.ok(e);
      d();
    });
  });

  it("where clause", function(d) {
    Sticker.where({ label: "test123" }).findOne().exec((e, x) => {
      //console.log('found where.findOne', x);
      assert(x._id === createdID);
      assert(x.created);
      assert(x.label);
      //assert.ok(e);
      d();
    });
  });

  it("delete", function(d) {
    const s = new Sticker({ _id: createdID });
    s.remove((e, x) => {
      assert(!!x);
      assert(e === null);
      assert(x === createdID);
      //assert.ok(e);
      d();
    });
  });

  let complexPackageID; // used for later tests on associations
  it('get id of a complex package', function(d) {
    knex.select('*').from('package_recommended_packages').limit(3).then(x=>{
      assert(x.length > 0);
      assert(x[0].package);
      complexPackageID = x[0].package;
      d();
    });
  });

  it("populate many to many", function(d) {
    Package.findByID(complexPackageID).populate("recommendedPackages").exec((e, x) => {
      //console.log('populate find', x.recommendedPackages);
      //console.log('populate find', x.category);
      //console.log(_.keys(x));

      assert(!!x.recommendedPackages.length > 0);
      assert(!!x.recommendedPackages[0].name);
      assert(!!x.recommendedPackages[0]._id);
      //assert(!!x.featureSticker);
      assert(e === null);
      d();
    });
  });

  it("populate one to many", function(d) {
    Package.findByID(complexPackageID).populate("category").exec((e, x) => {
      //console.log('populate find', x.recommendedPackages);
      //console.log('populate find', x.category);
      //console.log(x.name, '-', x.category);

      assert(!!x.category.title);
      assert(!!x.category._id);
      assert(!!x.category);
      assert(e === null);
      d();
    });
  });

  it("populate one to many + many to many", function(d) {
    Package
      .findByID(complexPackageID)
      .populate("recommendedPackages")
      .populate("category")
      .exec((e, x) => {
        assert(x._id===complexPackageID);
        assert(!!x.recommendedPackages.length > 0);
        assert(!!x.recommendedPackages[0].name);
        assert(!!x.recommendedPackages[0]._id);

        assert(!!x.category.title);
        assert(!!x.category._id);
        assert(!!x.category);
        assert(e === null);
        d();
      });
  });

  // save associations:
  /*
  it("create", function(d) {
    const s = new Sticker({ label: "test123" });
    s.save((e, x) => {
      //console.log('create', x);
      createdID = x;
      assert(!!x);
      assert(e === null);
      //assert.ok(e);
      d();
    });
  });*/
});
