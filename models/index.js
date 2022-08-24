var fs = require('fs');
var path = require('path');
var Sequelize = require('sequelize');
var lodash = require('lodash');

var dbConfig = require('../config/config.json').dbConfig;

var sequelize = new Sequelize(dbConfig.database, dbConfig.user,
		dbConfig.password, {
    		logging: (dbConfig.debug ? console.log : false),
			host : dbConfig.host,
			port : dbConfig.port,
			dialect : dbConfig.tipo,
			language : dbConfig.language,
			dialectOptions: {
        			insecureAuth: true
    		},
			pool : {
				maxConnections : 50,
				maxIdleTime : 60
			},
			define : {
				collate : dbConfig.collate,
				freezeTableName : true
			}
		});

var db = {};

console.log("Cargando Modulos de Sequealize.");

fs.readdirSync(__dirname).filter(function(file) {
	return (file.indexOf('.') !== 0) && (file !== 'index.js') && (file !== 'extends');
}).forEach(function(file) {
	var model = sequelize.import(path.join(__dirname, file));
	db[model.name] = model;
});

Object.keys(db).forEach(function(modelName) {
	if ('associate' in db[modelName]) {
		db[modelName].associate(db);
	}
});


module.exports = lodash.extend({
	sequelize : sequelize,
	Sequelize : Sequelize
}, db);

console.log("Modulos cargados.");