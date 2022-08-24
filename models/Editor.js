var tbConfig = require('../config/config.json').tbConfig.editores;

module.exports = function(sequelize, DataTypes) {
	var Editor = sequelize.define('Editor', {
		version : {
			type : DataTypes.STRING(40),
			allowNull : false,
			unique : true,
		},
		hash : {
			type : DataTypes.STRING(32),
			allowNull : false,
		}
	}, {
		freezeTableName : true,
		tableName : tbConfig.tabla,
		charset : tbConfig.charset,
	});

	return Editor;
};