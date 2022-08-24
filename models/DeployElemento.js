/**
 * New node file
 */
var tbConfig = require('../config/config.json').tbConfig.deployelemento;

module.exports = function(sequelize, DataTypes) {

	var DeployElemento = sequelize.define('DeployElemento', {
		elemento : {
			type : DataTypes.STRING(200),
			allowNull : false,
		},
		subelementos : {
			type 		: DataTypes.TEXT,
			allowNull 	: false,
			get 		: function() {
				try {
					return JSON.parse(this.getDataValue('subelementos'));
				} catch(error) {
					return [];
				}
			}
		},
		version : {
			type : DataTypes.INTEGER.UNSIGNED,
			allowNull : false,
		},
	}, {
		classMethods : {
			associate : function(models) {
				DeployElemento.belongsTo(models.Deploy, {
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

	return DeployElemento;
};