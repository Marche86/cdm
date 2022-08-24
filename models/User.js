var tbConfig = require('../config/config.json').tbConfig.usuarios;


module.exports = function(sequelize, DataTypes) {

	var User = sequelize.define('User', {
		usuario : {
			type : DataTypes.STRING(20),
			allowNull : false,
			unique : true,
		},
		clave : {
			type : DataTypes.STRING(40),
			allowNull : false,
		},
		nombre : {
			type : DataTypes.STRING(30),
			allowNull : false,
		},
		apellido : {
			type : DataTypes.STRING(30),
			allowNull : false,
		},
		habilitado : {
			type : DataTypes.ENUM('SI', 'NO'),
			defaultValue : 'SI',
			allowNull : false,
		},
		mail : {
			type : DataTypes.STRING(40),
			allowNull : true
		}
	}, {
		classMethods : {
			associate : function(models) {
				User.belongsToMany(models.Repositorio, {
					through : 'repositorios_usuarios'
				});
				User.hasMany(models.Permiso);
			}
		},
		freezeTableName : true,
		tableName : tbConfig.tabla,
		charset : tbConfig.charset,
	});

	return User;
};