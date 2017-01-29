# Mongoose-SQL Translator

This library covers the basic API surface of Mongoose and translates the models and calls to SQL.

For simple use-cases, no project code changes are required aside from a PostgreSQL connection statement.

```js
var db = require("mongoose-sql");
var e = process.environment;
//create connection
db.connect({
    client: e.DB_CLIENT || "pg",
    connection: {
      host: e.DB_HOST || "127.0.0.1",
      user: e.DB_USER || "user",
      password: e.DB_PASSWORD || "",
      database: e.DB_DATABASE || "test"
    }
});

db.migreateSchemas([Cat]).then(function() {
    console.log("moved data to PostgreSQL from Mongoose");
});
```

Mongoose API reference:
[http://mongoosejs.com/index.html](http://mongoosejs.com/index.html)
### note that not all Mongoose apis are covered

Libraries used: Sequelize, Knex, Lodash