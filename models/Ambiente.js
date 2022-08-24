var tbConfig = require('../config/config.json').tbConfig.ambiente;

var Ambiente_Extend = require('./extends/Ambiente.js');

module.exports = function(sequelize, DataTypes) {

	var Ambiente = sequelize
			.define(
					'Ambiente',
					{
						nombre : {
							type : DataTypes.STRING(20),
							allowNull : false,
							unique : true,
						},
					},
					{
						instanceMethods : sequelize.Utils._.extend({},
								new Ambiente_Extend()),
						classMethods : {
							associate : function(models) {
								Ambiente.belongsTo(models.Repositorio);

								Ambiente.hasMany(models.Deploy, {
									onDelete : 'CASCADE'
								});

								Ambiente.belongsTo(models.Deploy, {
									as : 'deployActual',
									constraints : false
								});
							},
							getForUpdate : function(transaccion, nombre, include) {
								if (!transaccion || !nombre)
									throw new Error(
											"Es necesario indicar la transacción y el nombre del repositorio.");
								
								return this.findOne({
									where : {
										nombre : nombre
									},
									include : include,
									transaction : transaccion,
									lock : transaccion.LOCK.UPDATE
								});
							}
						},
						freezeTableName : true,
						tableName : tbConfig.tabla,
						charset : tbConfig.charset,
						createdAt : 'fecha_creado',
						updateAt : 'fecha_actualizado'
					});

	return Ambiente;
};