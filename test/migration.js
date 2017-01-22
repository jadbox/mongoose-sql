const _ = require('lodash')
const MONGO_CONNECTION = "mongodb://localhost/zps-dev";

const mongoose = require('mongoose');
//console.log(mongoose.Schema);
const models = (require('./models')).init(mongoose.Schema);

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

    let i = 0;
    Package.find().exec( (e,x) => {
        if(i) return;
        i++;
        //console.log(e,'-', JSON.stringify(x));
        //console.log('--------');
        if(x.length === undefined) throw new Error('no length');
        setTimeout( __ => {
            const d = _.filter(x, x=>x.category);
            const v = d[0].toObject();
            console.log( JSON.stringify(v, null, "\t") );
            return;
            const vobj = { priority: 10 }; //x[0]
            
            delete v.__v;
            delete v._id;
            //delete v.segments;
            //delete v.featureSticker;
            delete v.category;
            //delete v.recommendedPackages;
            //delete v.influencers;
            //delete v.zInfluencers;
            //delete v.videoExamples;
            const y = _.keysIn(v); //_.pickBy(x[3], _.isFunction);
            console.log('==',  y, v.priority, v.name);
            //return;
            const np = new Package( v ); //, {include:['Category']}
            np.save( (e,x) => console.log('saved', e));
        }, 1512);
    })
}

init();
