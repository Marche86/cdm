var tbConfig = require('../config/config.json').tbConfig.recursos;

module.exports = function(sequelize, DataTypes) {

	var Recurso = sequelize.define('Recurso', {

		id : {
			type : DataTypes.INTEGER.UNSIGNED,
			allowNull : false,
			primaryKey: true
		},

		tipo : {
			type : DataTypes.ENUM("PREDEFINIDO", "ARMA", "CABEZA", "CASCO",
					"CUERPO", "EFECTO", "SONIDO", "ENTIDAD", "ESCUDO",
					"GRAFICO", "PISO", "HECHIZO", "PROPIEDAD_MAPA", "CRIATURA",
					"OBJETO", "RECURSO_IMAGEN", "RECURSO_INTERFACE",
					"RECURSO_MAPA", "RECURSO_SONIDO", 'LEGION_RANGO',
					'ARMADA_RANGO', 'NIVEL', 'ASPECTO', 'PISADA', 'MSGBIENVENIDA', 'CLASE'),
			allowNull : false,
			primaryKey: true
		},

		version : {
			type : DataTypes.INTEGER.UNSIGNED,
			allowNull : false,
		},

		estado : {
			type : DataTypes.ENUM('DISPONIBLE', 'TOMADO', 'CONFIRMADO'),
			allowNull : false,
		},

	}, {
		classMethods : {
			associate : function(models) {
				Recurso.belongsTo(models.User)
				Recurso.belongsTo(models.Repositorio);
			}
		},
		timestamps : true,
		freezeTableName : true,
		tableName : tbConfig.tabla,
		charset : tbConfig.charset,
	});

	return Recurso;
};
