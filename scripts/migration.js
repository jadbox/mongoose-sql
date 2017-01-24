const _ = require('lodash')
const MONGO_CONNECTION = "mongodb://localhost/zps-dev";

const mongoose = require('mongoose');
//console.log(mongoose.Schema);

const common = require('../test/common');
const models = common.getModels(mongoose.Schema);
const mapschema = require("../src/mapschema");
const Promise = require('bluebird').Promise;

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
    const Package = mongoose.model('Package', Package_Schema);

    const Sticker_Schema = new mongoose.Schema(models.Sticker)
    const Sticker = mongoose.model('Sticker', Sticker_Schema);

    const Category_Schema = new mongoose.Schema(models.Category);
    const Category = mongoose.model('Category', Category_Schema);

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

    Promise.mapSeries(migrateTables, migrateTable).then(y=>{
        console.log('everything done, yay');
    });;

    function create(Base, elem) {
        let v = elem.toObject();
        const _id = v._id;
        delete v.__v;
        delete v._id;
        v = _(v).mapValues( (v,k) => uuid[v] || v ).value();
        console.log(Base.table + ':' + JSON.stringify(v, null, "\t") );
        //console.log('v',v);
        //return;

        return mapschema.create(knex, Base, v).then(
            x => {
                console.log(x[0], '-', x.oid);
                uuid[_id] = x[0];
        });
    }

    function migrateTable(Base) {
        console.log('Base', Base.table);
        return new Promise(function (resolve, reject) {
            Base.mongoose.find().exec( (e,x) => {
                //if(i) return;
                //i++;
                //console.log(e,'-', JSON.stringify(x));
                //console.log('--------');
                if(x.length === undefined) throw new Error('no length');
                setTimeout( () => {

                Promise.mapSeries(x, y => create(Base, y) ).then(x=>{
                    console.log(Base.table + ' all done');
                    resolve('done');
                });
                //const d = _.filter(x, x=>x.category);
                
                //return;
                //const vobj = { priority: 10 }; //x[0]
                
                
                //delete v.segments;
                //delete v.featureSticker;
                ///delete v.category;
                //delete v.recommendedPackages;
                //delete v.influencers;
                //delete v.zInfluencers;
                //delete v.videoExamples;
                // migrate string values over
                

                //const y = _.keysIn(v); //_.pickBy(x[3], _.isFunction);
                //console.log('==',  y, v.priority, v.name);
                //return;
                ///const np = new Package( v ); //, {include:['Category']}
                ///np.save( (e,x) => console.log('saved', e));
                }, 1512);
            });
        });
    }

}

init();
