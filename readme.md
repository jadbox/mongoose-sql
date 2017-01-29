# Mongoose-SQL Translator

<img height="224px" src = "http://t10.deviantart.net/l0aLpKFx8pPp4COINIGMRXIVWuQ=/fit-in/700x350/filters:fixed_height(100,100):origin()/pre05/503a/th/pre/f/2014/341/1/5/rikki_tikki_tavi_by_hidde99-d88zxp6.png"/>

This library covers the basic API surface of Mongoose and translates the models and calls to SQL.

For simple use-cases, no project code changes are required aside from a PostgreSQL connection statement.

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

// Migrations
var mongoose = require("mongoose");
var Cat_Schema = new mongoose.Schema(CatModel);
var Cat = mongoose.model("Cat", Cat_Schema);
db.migreateSchemas([Cat]).then(function() {
    console.log("moved data to PostgreSQL from Mongoose");
});

// Use PG like Mongoose
var Cat_Schema = new db.Schema(CatModel);
var Cat = db.model("Cat", Cat_Schema);
Cat.find().exec(muHandler);
Cat.findById().exec(muHandler);
Cat.find().sort('breed').exec(muHandler);
Cat.find().populate('owner').exec(muHandler);

var simba = new Cat( { CatObject } );
simba.save(function() {

});
simba.remove(function() {
    
});
```

Mongoose API reference:
[http://mongoosejs.com/index.html](http://mongoosejs.com/index.html)
### note that not all Mongoose apis are covered

Libraries used: Sequelize, Knex, Lodash