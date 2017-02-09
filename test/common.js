const assert = require('chai').assert;
//const Promise = require('q');

const mp = require('../src/index.js');
const Schema = mp.Schema;
let Models;

//const mapschema = require('../src/mapschema');

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
let knex = null;

function initDB() {
    return knex ? knex : knex = require('knex')(connectionParams);
}

function getModels(_Schema) {
    return Models ? Models : Models = require('./models').init(_Schema || Schema);
}

function base() {
    return mb;
}

module.exports = { initDB, getModels, base, mp };