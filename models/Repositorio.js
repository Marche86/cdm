var tbConfig = require('../config/config.json').tbConfig.repositorios;

var Repositorio_Extend = require('./extends/Repositorio.js');

module.exports = function(sequelize, DataTypes) {
	var Repositorio = sequelize
			.define(
					'Repositorio',
					{
						nombre : {
							type : DataTypes.STRING(20),
							allowNull : false,
							unique : true,
						},
						estado : {
							type : DataTypes.ENUM('ABIERTO', 'CERRADO'),
							/*
							 * Esto atribute lo necesitamos porque el compartir
							 * se hace con la ejecucion de varios comandos
							 */
							defaultValue : 'ABIERTO',
							allowNull : false
						}

					},
					{

						instanceMethods : sequelize.Utils._.extend({},
								new Repositorio_Extend()),
						classMethods : {
							associate : function(models) {

								Repositorio.belongsToMany(models.User, {
									through : 'repositorios_usuarios'
								});
															
								Repositorio.hasMany(models.Commit);

								Repositorio.hasMany(models.Recurso);

								Repositorio.belongsTo(models.Commit, {
									as : 'ultimoCommit',
									constraints : false
								});
							},
							getForUpdate : function(transaccion, nombre,
									include) {
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
					});

	return Repositorio;
};