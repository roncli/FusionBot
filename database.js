var settings = require("./settings"),
    sql = require("mssql"),
    
    Database = {};

Database.query = (sqlStr, params) => {
    "use strict";

    return new Promise((resolve, reject) => {
        if (!params) {
            params = {};
        }
        
        var conn = new sql.Connection(settings.database, (err) => {
            var paramKeys = Object.keys(params),
                ps;
            
            if (err) {
                reject(err);
                return;
            }
            
            ps = new sql.PreparedStatement(conn);
            paramKeys.forEach((key) => {
                ps.input(key, params[key].type);
            });
            ps.multiple = true;
            ps.prepare(sqlStr, (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                ps.execute(paramKeys.reduce((acc, key) => {
                    acc[key] = params[key].value;
                    return acc;
                }, {}), (err, data) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    ps.unprepare((err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        resolve(data);
                    });
                });
            });
        });
    });
};

Database.TYPES = sql.TYPES;

Object.keys(sql.TYPES).forEach((key) => {
    "use strict";
    
    Database[key] = sql.TYPES[key];
    Database[key.toUpperCase()] = sql.TYPES[key];
});

module.exports = Database;
