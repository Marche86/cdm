var tbConfig = require('../config/config.json').tbConfig.ingresos;

module.exports = function(sequelize, DataTypes) {

	var Ingreso = sequelize.define('Ingreso', {
		
		useragent : {
			type : DataTypes.TEXT,
			allowNull : false,
		},
		resultado : {
			type : DataTypes.ENUM('EXITO', 'FALLIDO'),
			defaultValue : 'EXITO',
			allowNull : false,
		},
		ip : {
			type : DataTypes.INTEGER.UNSIGNED,
			allowNull : false,
		},
	
	}, {
		classMethods : {
			associate : function(models) {
				Ingreso.belongsTo(models.User, {
					as : "User"
				});
			}
		},
		freezeTableName : true,
		tableName : tbConfig.tabla,
		charset : tbConfig.charset,
		createdAt : 'fecha',
		updatedAt : false,
		timestamp : true,
	});

	return Ingreso;
};