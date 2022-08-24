var tbConfig = require('../config/config.json').tbConfig.deploy;

module.exports = function(sequelize, DataTypes) {

	var Deploy = sequelize.define('Deploy', {
		comentario : {
			type : DataTypes.TEXT,
			allowNull : false,
		},
		version : {
			type : DataTypes.INTEGER.UNSIGNED,
			allowNull : false,
		},
		fechaProgramada : {
			type : DataTypes.DATE,
			allowNull : false,
		},
		estado : {
			type : DataTypes.ENUM('ACTIVO', 'CANCELADO', 'REMOVIDO'),
			defaultValue : 'ACTIVO',
			allowNull : false
		},
		indicaciones : {
			type : DataTypes.TEXT,
			allowNull : false,
			set : function(indicaciones) {
					try {
						this.setDataValue('indicaciones', JSON.stringify(indicaciones));
					} catch (error) {
						throw error;
					}
			},
			get : function() {
					try {
						return JSON.parse(this.getDataValue('indicaciones'));
					} catch(error) {
						return {};
					}
			}
		}
	}, {
		classMethods : {
			associate : function(models) {
				Deploy.belongsTo(models.Ambiente);
				Deploy.belongsTo(models.User);
				Deploy.hasMany(models.DeployElemento,  {
					onDelete : 'CASCADE'
				});
			}
		},
		indexes : [{
			unique : true,
			fields : ['AmbienteID', 'version']
		}],
		freezeTableName : true,
		tableName : tbConfig.tabla,
		charset : tbConfig.charset,
		updateAt : false
	});

	return Deploy;
};