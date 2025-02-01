![test](https://github.com/themost-framework/sqlite/workflows/test/badge.svg)
[![npm](https://img.shields.io/npm/v/@themost%2Fsqlite.svg)](https://www.npmjs.com/package/@themost%2Fsqlite)
![Libraries.io dependency status for latest release, scoped npm package](https://img.shields.io/librariesio/release/npm/@themost/sqlite)
![GitHub top language](https://img.shields.io/github/languages/top/themost-framework/sqlite)
[![License](https://img.shields.io/npm/l/@themost/sqlite)](https://github.com/themost-framework/sqlite/blob/master/LICENSE)
![GitHub last commit](https://img.shields.io/github/last-commit/themost-framework/sqlite)
![GitHub Release Date](https://img.shields.io/github/release-date/themost-framework/sqlite)
[![npm](https://img.shields.io/npm/dw/@themost/sqlite)](https://www.npmjs.com/package/@themost%2Fsqlite)

![MOST Web Framework Logo](https://github.com/themost-framework/common/raw/master/docs/img/themost_framework_v3_128.png)

# @themost/sqlite
MOST Web Framework SQLite Data Adapter

License: [BSD-3-Clause](https://github.com/themost-framework/sqlite/blob/master/LICENSE)

## Install

    npm install @themost/sqlite

## Usage

Register SQLite adapter on app.json as follows:

    "adapterTypes": [
        ...
          { "name":"SQLite Data Adapter", "invariantName": "sqlite", "type":"@themost/sqlite" }
        ...
        ],
    adapters: [
        ...
        { 
            "name":"local-db", "invariantName":"sqlite", "default":true,
            "options": {
                database:"db/local.db"
            }
        }
        ...
    ]
}

or create a new instance of `SqliteAdapter` class for connecting to SQLite database.

```javascript
const { SqliteAdapter } = require('@themost/sqlite');
const { QueryExpression } = require('@themost/query');
const db = new SqliteAdapter({
    database: 'db/local.db'
});
const query = new QueryExpression()
    .select(({ id, name, category, model, price }) => ({
        id,
        name,
        category,
        model,
        price,
    })).from('ProductData')
    .where((x) => {
        return x.price > 500 && x.category === "Laptops";
    })
    .orderByDescending((x) => x.price)
    .take(10);
```

Read more about [MOST Web Framework query language provided by @themost/query](https://github.com/themost-framework/query?#themostquery)

Use [query playground project at codesanbox.io](https://codesandbox.io/p/devbox/query-playground-zc8fg9) to learn more about the query language specification of [@themost-framework](https://github.com/themost-framework)

![codesandbox.io_query-playground-1.png](docs/img/codesandbox.io_query-playground-1.png)

