var tbConfig = require('../config/config.json').tbConfig.sesiones;

module.exports = function(sequelize, DataTypes) {

	var Sesion = sequelize
			.define(
					'Sesion',
					{
						suid : {
							type : DataTypes.STRING,
							allowNull : false,
							primaryKey : true
						},
						keepsActivos : {
							type : DataTypes.INTEGER.UNSIGNED,
							allowNull : false,
							defaultValue : 0,
						}
					},
					{
						classMethods : {
							associate : function(models) {
								Sesion.belongsTo(models.User);
							}
						},
						instanceMethods : {
							cerrar : function(callback) {
								
								var sesion = this;
								
								return sequelize.models.SesionAntigua.create(
										{
											fechaIniciada : sesion.fechaIniciada,
											fechaCerrada : sesion.fechaActualizada,
											keepsActivos : sesion.keepsActivos,
										}
								).then(function (sesion_antigua) {
									return sesion_antigua.setUser(sesion.User);
									}								
								).then(function(sesion_antigua) {
									return sesion_antigua;
								}).catch(function(error) {
									logger
									.error("Error al cerrar la sesión :"											+ error);
									throw ({ mensaje : "Error al cerrar la sesión :"});
								});

							}
						},
						freezeTableName : true,
						tableName : tbConfig.tabla,
						charset : tbConfig.charset,
						createdAt : 'fechaIniciada',
						updatedAt : 'fechaActualizada'
					});

	return Sesion;
};
