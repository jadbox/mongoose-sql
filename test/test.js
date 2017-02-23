// Simple mongoose test
// TODO: refactor to unit test
const assert = require('chai').assert;
const Promise = require('q');
const _ = require('lodash');

const mp = require('../src/index.js');
const e = process.env;
mp.connect({
    client: e.DB_CLIENT || 'pg',
    connection: {
      host: e.DB_HOST || '127.0.0.1',
      user: e.DB_USER || 'jonathan.dunlap',
      password: e.DB_PASSWORD || '',
      database: e.DB_DATABASE || 'test'
    }
  });

const Schema = mp.Schema;
const Models = require('./models').init(Schema);

const mapschema = require('../src/mapschema');

const localPG = {
  client: 'pg',
  connection: {
    user: 'jonathan.dunlap',
    database: 'test',
    port: 5432,
    host: 'localhost',
    password: ''
  },
  debug: false,
  pool: { min: 1, max: 2 }
};

const noPG = { client: 'pg' };

const connectionParams = localPG;

//localPG noPG
let knex;
describe('utils', function() {
  knex = require('knex')(connectionParams);

  it('finds relative tables', function(d) {
    const x = mapschema.getRelations('Package', Models.Package);
    //console.log(x);
    assert.deepEqual(x, [
      {
        category: { ref: 'Category', rel: '1', refTable: 'category' },
        featureSticker: { ref: 'Sticker', refTable: 'sticker', rel: '1' }
      },
      {
        recommendedPackages: {
          ref: 'Package',
          refTable: 'package',
          rel: '>1',
          ltable: 'package_recommended_packages'
        }
      }
    ]);
    d();
  });
  // ====================
  /* TODO Migration tests
  it('creates internal schema representation', function(d) {
    console.log('-');
    const x = mapschema.parse('Package', Models.Package, knex);
    const x1 = mapschema.parse('Sticker', Models.Sticker, knex);
    const x2 = mapschema.parse('Category', Models.Category, knex);
    console.log('parse\n', x);
    const y = mapschema.sync(knex, x);
    const y1 = mapschema.sync(knex, x1);
    const y2 = mapschema.sync(knex, x2);
    const yS = y.toString();
    console.log('sync\n', yS);
    //Promise.all([y1, y2, y], x=> {   
    //});
    y1.then(x => {
      console.log('1 sync done', JSON.stringify(x));
      y2.then(x => {
        console.log('2 sync done', JSON.stringify(x));
        y.then(x => {
        console.log('0 sync done', JSON.stringify(x));
        d();
        });
      });
    });
  });
  */
  /*
  // ====================
  it('create', function(d) {
    console.log('-');
    const x = mapschema.parse('Package', Models.Package, knex);
    //console.log('parse\n', x);
    const obj = {name: 123, bar:666, '_id': 1};
    const y = mapschema.create(knex, x, obj).toString();
    console.log('create\n', y);
    d()
  });*/
});

describe('Mongoose API', function() {
  const PackageSchema = new Schema(Models.Package);
  const Package = mp.model('Package', PackageSchema);

  const CategorySchema = new Schema(Models.Category);
  const Category = mp.model('Category', CategorySchema);

  const StickerSchema = new Schema(Models.Sticker);
  const Sticker = mp.model('Sticker', StickerSchema);

  before(function(d) {
    knex('sticker').where('label', 'test123').del().then(x=>d());
  });

  it('find', function(d) {
    Sticker.find().exec((e, x) => {
      //console.log('found find', x.length);
      assert(x.length > 0);
      d();
    });
  });

  it('find using promise', function(d) {
    Promise.when(Sticker.find().exec(), x => {
      assert(x.length > 0);
      Sticker.find().exec().then(x => {
        assert(x.length > 0);
        d();
      });
    });
  });

  it('find using promise.all', function(d) {
    Promise.all([
        Sticker.find().exec(), Sticker.find().exec()
      ])
      .then(x => {
        assert(x[0].length > 0);
        assert(x[1].length > 0);
        d();
    }).catch(e=> { throw new Error(e); });
  });

  it('find using promise.all.when', function(d) {
    Promise.all([
        Promise.when(Sticker.find().exec()),
        Promise.when(Sticker.find().exec())
      ])
      .then(x => {
        assert(x[0].length > 0);
        assert(x[1].length > 0);
        d();
    }).catch(e=> { throw new Error(e); });
  });

  it('find Sorted', function(d) {
    Sticker.find().sort('label').exec((e, x) => {
      //console.log('Sorted find', x).length;
      assert(e===null, 'error: ' + e);
      assert(x.length > 0);
      assert(
        _.reduce(
          x,
          (acc, i) => {
            assert(i.label >= acc);
            return i.label;
          },
          ''
        )
      );
      //assert.ok(e);
      d();
    });
  });

  it('find reverse Sorted', function(d) {
    Sticker.find().sort('-label').exec((e, x) => {
      //console.log('Sorted find', x).length;
      assert(e===null, 'error: ' + e);
      assert(x.length > 0);
      assert(
        _.reduce(
          x,
          (acc, i) => {
            assert(i.label <= acc);
            return i.label;
          },
          'zzzz'
        )
      );
      //assert.ok(e);
      d();
    });
  });

  let createdID = -1;
  it('create', function(d) {
    const s = new Sticker({ label: 'test123', notValid:'ignore' });
    assert.equal(s.vobj.label, 'test123');
    assert.equal(s.label, 'test123');
    
    const s2 = _.merge(s, { notValid:'bar' });
    assert.equal(s.vobj.notValid, 'bar', 'notValid not showing up on model.vobj');
    assert.equal(s.notValid, 'bar', 'merge into model not occurring for proxy');

    s.save((e, x) => {
      //console.log('created _id', x);
      createdID = x;
      assert(e===null, 'error: ' + e);
      assert(!!x);
      d();
    });
  });

  it('unique check', function(d) {
    const s = new Sticker({ label: 'test123' });
    s.save((e, x) => {
      assert.isNotNull(e, 'error: ' + e);
      assert(e.toString().indexOf('duplicate key value violates') > -1);
      assert(!x);
      d();
    });  
  });

  it('required check', function(d) {
    const s = new Sticker({ label: null });
    s.save((e, x) => {
      assert.isNotNull(e, 'error: ' + e);
      assert(e.toString().indexOf('violates not-null constraint') > -1);
      assert(!x);
      d();
    });  
  });

  it('findByID', function(d) {
    Sticker.findByID(createdID).exec((e, x) => {
      assert(e===null, 'error: ' + e);
      //console.log('x', x);
      assert(x._id === createdID);
      assert(x.created);
      assert(x.label);
      //assert.ok(e);
      d();
    });
  });

  it('findByID using string id', function(d) {
    Sticker.findByID('' + createdID.toString()).exec((e, x) => {
      assert(e===null, 'error: ' + e);
      assert(x._id === createdID);
      assert(x.label);
      d();
    });
  });

  it('findOne', function(d) {
    Sticker.findOne({ label: 'test123' }).exec((e, x) => {
      //console.log('found findOne', x);
      assert.isNull(e, 'error: ' + e);
      assert(x._id === createdID);
      assert(x.created);
      assert(x.label);
      //assert.ok(e);
      d();
    });
  });

  it('where clause', function(d) {
    Sticker.where({ label: 'test123' }).findOne().exec((e, x) => {
      //console.log('found where.findOne', x);
      assert.equal(x._id, createdID);
      assert.isNotNull(x.created);
      assert.equal(x.label, 'test123');
      //assert.ok(e);
      d();
    });
  });

  it('where.findOne promise.all', function(d) {
    Promise.all([ 
        Sticker.where({ label: 'test123' }).findOne().exec()
    ]).then( ([x]) => {
      assert.equal(x._id, createdID);
      assert.isNotNull(x.created);
      assert.equal(x.label, 'test123');
      //assert.ok(e);
      d();
    });
  });

  it('upsert', function(d) {
    const s = new Sticker({ _id: createdID, label: 'test555' });
    s.save((e, x) => {
      //console.log('created _id', x);
      assert.isNull(e, 'error: ' + e);
      assert(!!x);
      Sticker.find().exec((e, x) => {
        assert.equal(e, null, 'error: ' + e);

        const old = _.filter(x, y=>y.label==='test123');
        assert.equal(old.length, 0, 'but found ' + old.length);

        const n = _.filter(x, y=>y.label==='test555');
        assert.equal(n.length, 1);
        assert.equal(n[0]._id, createdID);
        assert.isNotNull(n[0].created);
        d();
      });
    });
  });

  it('delete', function(d) {
    const s = new Sticker({ _id: createdID });
    s.remove((e, x) => {
      assert.isNull(e);
      //assert(!!x);
      assert.equal(x, createdID);
      //assert.ok(e);
      createdID = -1;
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

  it('populate many to many', function(d) {
    Package.findByID(complexPackageID).populate('recommendedPackages').exec((e, x) => {
      assert(e === null);
      assert(!!x.recommendedPackages.length > 0);
      assert(!!x.recommendedPackages[0].name);
      assert(!!x.recommendedPackages[0]._id);
      //assert(!!x.featureSticker);
      d();
    });
  });

  it('negative populate', function(d) {
    Package.findByID(complexPackageID).populate('-videoExamples', '-category').exec((e, x) => {
      assert(e === null);
      assert(!!x._id);
      assert(!x.videoExamples);
      assert(!x.category);
      d();
    });
  });

  it('negative select', function(d) {
    Package.findByID(complexPackageID).select('-videoExamples').select('-category').exec((e, x) => {
      assert(e === null);
      assert(!!x._id);
      assert(!x.videoExamples);
      assert(!x.category);
      d();
    });
  });

  it('findByID with one to many #1', function(d) {
    Package.findByID(complexPackageID).populate('category').exec((e, x) => {
      assert(e === null);
      assert(!!x.category.title);
      assert(!!x.category._id);
      assert(!!x.category);
      d();
    });
  });

  it('find all with one to one #2', function(d) {
    Package.find().populate('category').exec((e, x) => {
      const hasCategory = _.filter(x, xx => xx.category && xx.category._id);
      assert(hasCategory.length > 1);
      assert(!!hasCategory[0]._id);
      assert(e === null);
      d();
    });
  });

  it('find all with one to one #3', function(d) {
    Package.find().populate('featureSticker').exec((e, x) => {
      assert(e === null);
      const hasCategory = _.filter(x, xx => xx.featureSticker);
      assert(hasCategory.length === 0);
      d();
    });
  });

  it('populate one to many + many to many', function(d) {
    Package
      .findByID(complexPackageID)
      .populate('recommendedPackages')
      .populate('category')
      .exec((e, x) => {
        assert.isNull(e, 'error: ' + e);
        assert.equal(x._id, complexPackageID);
        assert(x.recommendedPackages.length > 0);
        assert.isNotNull(x.recommendedPackages[0].name);
        assert.isNotNull(x.recommendedPackages[0]._id);

        assert.isNotNull(x.category.title);
        assert.isNotNull(x.category._id);
        d();
      });
  });

  let recommendedPackages = [];
  it('populate using array arg', function(d) {
    Package
      .findByID(complexPackageID)
      .populate(['recommendedPackages','category'])
      .exec((e, x) => {
        assert.isNull(e, 'error: ' + e);
        assert.equal(x._id, complexPackageID);
        assert(x.recommendedPackages.length > 0);
        assert.isNotNull(x.recommendedPackages[0]._id);
        // for next test
        recommendedPackages.push(x.recommendedPackages[0]._id, x.recommendedPackages[1]._id);

        assert(!!x.category.title);
        d();
      });
  });

  let nestedID = -1;
  it('create with nested', function(d) {
    const s = new Package({ name: 'test123', recommendedPackages: recommendedPackages, cptPackageId: 1 });
    s.save((e, id) => {
      assert.isNull(e, 'error: ' + e);
      assert(!!s.vobj._id, 'no ID given to saved object');
      assert.equal(id, s.vobj._id, `saved id ${id} not matches model: ${s.vobj._id}`);
      nestedID = s.vobj._id;
      Package.findByID(s.vobj._id)
        .exec((e, x) => {
          assert.isNull(e, 'error: ' + e);
          assert.equal(x.name, 'test123', 'label does not match test123: ' + x.name);
          assert.sameMembers(x.recommendedPackages, recommendedPackages, x.recommendedPackages + '-' + recommendedPackages);
          d();
        });
    });
  });
  
  it('remove an item from an associated table', function(d) {
    const s = new Package({ _id: nestedID, name: 'test123', recommendedPackages: [recommendedPackages[0]], cptPackageId: 1 });
    s.save((e, id) => {
      assert.isNull(e, 'error: ' + e);
      assert(!!s.vobj._id, 'no ID given to saved object');
      assert.equal(id, s.vobj._id, `saved id ${id} not matches model: ${s.vobj._id}`);
      Package.findByID(s.vobj._id)
        .exec((e, x) => {
          assert.isNull(e, 'error: ' + e);
          assert.equal(x.recommendedPackages.length, 1);
          assert.equal(x.recommendedPackages[0], [recommendedPackages[0]], 
            x.recommendedPackages + '-' + recommendedPackages[0]);
          d();
        });
    });
  });

  it('remove record for associated tests', function(d) {
    const s = new Package({ _id: nestedID });
    s.remove(() => {
      nestedID = -1;
      d();
    });
  });



  after(function() {
    if(createdID > -1) {
      const s = new Sticker({ _id: createdID });
      s.remove((e, x) => {});
    }
    if(nestedID > -1) {
      const s = new Package({ _id: nestedID });
      s.remove(() => {});
    }
  })

  // save associations:
  /*
  it('create', function(d) {
    const s = new Sticker({ label: 'test123' });
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
