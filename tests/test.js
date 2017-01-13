// Simple mongoose test
// TODO: refactor to unit test

const mongoose = require('../index.js');
const Schema = mongoose.Schema;
const Models = require('./models').init(Schema);

PackageSchema = new Schema(Models.Package)

Package = mongoose.model('Package', PackageSchema)

// Category
CategorySchema = new Schema(Models.Category);

Category = mongoose.model('Category', CategorySchema);

// Sticker Model

StickerSchema = new Schema(Models.Sticker);

mongoose.model('Sticker', StickerSchema);