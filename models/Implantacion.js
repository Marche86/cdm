/**
 * Este modelo representa a una implantación de una actualizacion (deploy) en un
 * ambiente que la realiza un usuario.
 */
var tbConfig = require('../config/config.json').tbConfig.implantacion;

module.exports = function(sequelize, DataTypes) {
	var Implantacion = sequelize
			.define(
					'Implantacion',
					{
						estado : {
							type : DataTypes.ENUM('EXITO', 'FALLIDO'),
							defaultValue : 'EXITO',
							allowNull : false
						},
						informacion : {
							type : DataTypes.TEXT,
							allowNull : false,
							comment : "Informacion adicional entregada por el usuario implantador",
						}
					}, {
						classMethods : {
							associate : function(models) {
								// Lo pongo directo acá aunque se puede obtener
								// por el Deploy
								Implantacion.belongsTo(models.Ambiente);
								Implantacion.belongsTo(models.Deploy);
								Implantacion.belongsTo(models.User);
							}
						},
						freezeTableName : true,
						tableName : tbConfig.tabla,
						charset : tbConfig.charset,
					});

	return Implantacion;
};