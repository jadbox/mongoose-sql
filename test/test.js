// Simple mongoose test
// TODO: refactor to unit test
var assert = require('assert');

const mp = require('../src/index.js');
const Schema = mp.Schema;
const Models = require('./models').init(Schema);

const mapschema = require('../src/mapschema');

describe("test", function() {
    it('', function(d) {
        const x = mapschema.getRelations('Package', Models.Package);
        console.log(x);
        d();
    })
})

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