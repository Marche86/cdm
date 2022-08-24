var tbConfig = require('../config/config.json').tbConfig.commit_archivo;

module.exports = function(sequelize, DataTypes) {

	var CommitArchivo = sequelize
			.define(
					'CommitArchivo',
					{
						nombre : {
							type : DataTypes.STRING(200),
							allowNull : false,
							comment : "Nombre del archivo"
						},
						tamano : {
							type : DataTypes.INTEGER.UNSIGNED,
							allowNull : false,
							comment : "Tamaño en bytes del archivo"
						},
						destino : {
							type : DataTypes.STRING(200),
							allowNull : false,
							comment : "A donde debe ser parcheado el archivo"
						},
						cambios : {
							type 		: DataTypes.TEXT,
							allowNull 	: false,
							comment 	: "Explicacion de los cambios que contiene este archivo. En formato JSON",
							get 		: function() {
									try {
										return JSON.parse(this.getDataValue('cambios'));
									} catch(error) {
										return [];
									}
							}
						},
						headers : {
							type : DataTypes.TEXT,
							allowNull : false,
							comment : "Información adicional para el tratamiento de este archivo. En formato JSON"
						},
					}, {
						instanceMethods : {
							/**
							 * Retorna el elemento relacionado a este commit archivo
							 * return {db.Elemento}
							 */
							getElemento() {
								return Elementos.obtenerElemento(this.destino);
							},
						},
						classMethods : {
							associate : function(models) {
								CommitArchivo.belongsTo(models.Commit, {
									onDelete : 'CASCADE'
								});
							}
						},
						freezeTableName : true,
						tableName : tbConfig.tabla,
						charset : tbConfig.charset,
						createdAt : false,
						updateAt : false
					});

	return CommitArchivo;
};