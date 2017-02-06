const _ = require('lodash');
const Mongoose_Schema = require('mongoose').Schema;

const DEBUG = process.env.DEBUG || 1;

// Type Map from Mongoose
module.exports = class Schema {
  // Field type conversion (non-collection)
  constructor(params, options) {
    this.methods = {};
    this.statics = {}; // TODO research this in Mongoose

    //this.def = params;
    this.obj = params; // for Mongoose compatibility
    this.options = options; // unused
    //if (CONNECT_MONGO) this.mongo = new monSchema(params);
  }

  // TODO
  // actionName == save
  pre(actionName, dec) {
    console.log('TODO pre');
  }

  path(p) {
    return {
      validate: (v, onErrorMsg) => {
        // TODO stub
      }
    };
  }

  static get ObjectId() {
    return Mongoose_Schema.ObjectId;
  }
};
