const _ = require("lodash");
const mongoose = require("mongoose");

const DEBUG = process.env.DEBUG || 1;

// Type Map from Mongoose
module.exports = class Schema {
  // Field type conversion (non-collection)
  constructor(params) {
    this.def = params;
    if (CONNECT_MONGO) this.mongo = new monSchema(params);
  }

  static get ObjectId() {
    return null; //mongoose.Schema;
  }
};
