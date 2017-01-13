const MONGO_CONNECTION = "mongodb://localhost/zps-dev";

const mongoose = require('mongoose');
console.log(mongoose.Schema);
const models = (require('./tests/models')).init(mongoose.Schema);

mongoose.connect(MONGO_CONNECTION);
const mongoose_proxy = require('./index');

function init() {
    const Package_Schema = new mongoose_proxy.Schema(models.Package);
    const Package = mongoose_proxy.model('Package', Package_Schema);

    const Sticker_Schema = new mongoose_proxy.Schema(models.Sticker)
    const Sticker = mongoose_proxy.model('Sticker', Sticker_Schema);

    const Category_Schema = new mongoose_proxy.Schema(models.Category);
    const Category = mongoose_proxy.model('Category', Category_Schema);

    let i = 0;
    Package.mongo.find().exec( (e,x) => {
        if(i) return;
        i++;
        //console.log(e,'-', JSON.stringify(x));
        console.log('--------');
        if(x.length === undefined) throw new Error('no length');
        setTimeout( __ => {
            const np = new Package(x[0]);
            np.save(x => console.log('saved'));
        }, 1512);
    })
}

init();
