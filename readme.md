# Mongoose-SQL

Mongoose compatible interface for PostgreSQL

<img height="224px" src = "http://t10.deviantart.net/l0aLpKFx8pPp4COINIGMRXIVWuQ=/fit-in/700x350/filters:fixed_height(100,100):origin()/pre05/503a/th/pre/f/2014/341/1/5/rikki_tikki_tavi_by_hidde99-d88zxp6.png"/>

Mongoose-SQL covers the basic API surface of [Mongoose](http://mongoosejs.com) [ORM for Mongo] to interface and migrate data to PostgreSQL. This is effectively a small ORM over PostgreSQL that resembles the Mongoose API.

This library requires ES6 with Node.JS 6+ and uses [Knex](http://knexjs.org/) to interface with PostgreSQL.

```bash
npm install mongoose-sql
```

```js
var db = require("mongoose-sql");
var e = process.environment;

// Create connection: note default environment variables
// returns a Knex instance
db.connect({
    client: e.DB_CLIENT || "pg",
    connection: {
      host: e.DB_HOST || "127.0.0.1",
      user: e.DB_USER || "user",
      password: e.DB_PASSWORD || "",
      database: e.DB_DATABASE || "test"
    }
});

// Get Knex instance if needed
var knex = db.getKnex();

// Use Mongoose-like operations upon PostgreSQL tables
var Cat_Schema = new db.Schema(CatModel);
var Cat = db.model("Cat", Cat_Schema);
Cat.find().exec(myHandler); // find() returns all rows
Cat.findById(123).exec(myHandler); // find by row id
Cat.findOne({name: 'fluffy'}).exec(myHandler); // findOne
Cat.where({name: 'fluffy'}).findOne().exec(myHandler); // find by where
Cat.find().sort('breed').exec(myHandler); // sort
Cat.find().populate('owner').exec(myHandler); // outer left join

var simba = new Cat( { CatObject } );
simba.save(function() {

});
simba.remove(function() {
    
});

// Migrations (WIP)
var mongoose = require("mongoose"); // instance Mongoose
var Cat_Schema_Mongo = new mongoose.Schema(CatModel); // make a mongoose schema
var Cat_Mongo = mongoose.model("Cat", Cat_Schema_Mongo); // make a mongoose model
db.migreateSchemas([Cat_Mongo]).then(function() { // call migreateSchemas with model
    console.log("moved data to PostgreSQL from Mongoose");
});
```

Mongoose API reference:
[http://mongoosejs.com/index.html](http://mongoosejs.com/index.html)
### note that not all Mongoose apis are covered

## Migrations (WIP)

Based client Schema definitions, the library will try to create PostgreSQL tables with fields of the right types.

* One-to-one relationships will have foreign key constraints
* Many-to-many relationships will get their own link table
* Object or list of object key values (without schema links) will become jsonb fields
