var tbConfig = require('../config/config.json').tbConfig.permisos;

module.exports = function(sequelize, DataTypes) {

	var Bug = sequelize.define('Permiso', {

		nombre : {
			type : DataTypes.TEXT,
			allowNull : false
		},
		acceso : {
			type : DataTypes.INTEGER,
			allowNull : false
		}
	}, {
		classMethods : {
			associate : function(models) {
				Bug.belongsTo(models.User, {
					as : "User"
				});
			}
		},
		freezeTableName : true,
		tableName : tbConfig.tabla,
		charset : tbConfig.charset
	});

	return Bug;
};