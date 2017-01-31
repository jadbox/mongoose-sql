const _ = require("lodash");
const Mongoose_Schema = require('mongoose').Schema;

const DEBUG = process.env.DEBUG || 1;

// Type Map from Mongoose
module.exports = class Schema {
  // Field type conversion (non-collection)
  constructor(params, options) {
    this.def = params;
    this.obj = this.def; // for Mongoose compatibility
    this.options = options; // unused
    //if (CONNECT_MONGO) this.mongo = new monSchema(params);
  }

  static get ObjectId() {
    return Mongoose_Schema.ObjectId;
  }
};
