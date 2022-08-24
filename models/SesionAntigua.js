/**
 * 
 */
var tbConfig = require('../config/config.json').tbConfig.sesiones_antiguas;

module.exports = function(sequelize, DataTypes) {

	var SesionAntigua = sequelize.define('SesionAntigua', {
		fechaIniciada : {
			type : DataTypes.DATE,
			allowNull : false,
		},
		fechaCerrada : {
			type : DataTypes.DATE,
			allowNull : false,
		},
		keepsActivos : {
			type : DataTypes.INTEGER.UNSIGNED,
			allowNull : false,
		},
	}, {
		classMethods : {
			associate : function(models) {
				SesionAntigua.belongsTo(models.User, {
					as : "User"
				});
			}
		},
		freezeTableName : true,
		tableName : tbConfig.tabla,
		charset : tbConfig.charset,
		createdAt: false,
		updatedAt: false,
	});

	return SesionAntigua;
};
