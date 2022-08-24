
var tbConfig = require('../config/config.json').tbConfig.bugs;

module.exports = function(sequelize, DataTypes) {

	var Bug = sequelize.define('Bug', {

		metodo : {
			type : DataTypes.TEXT,
			allowNull : false
		},
		error : {
			type : DataTypes.TEXT,
			allowNull : false
		},
		explicacion : {
			type : DataTypes.TEXT,
			allowNull : false
		},
		datospc : {
			type : DataTypes.TEXT,
			allowNull : false
		},
		estado : {
			type : DataTypes.ENUM('REPORTADO', 'CORREGIDO'),
			defaultValue : 'REPORTADO',
			allowNull : false
		}
	}, {
		classMethods : {
			associate : function(models) {
				Bug.belongsTo(models.User);
			}
		},
		freezeTableName : true,
		tableName : tbConfig.tabla,
		charset : tbConfig.charset,
		createdAt : 'fecha',
	});

	return Bug;
};