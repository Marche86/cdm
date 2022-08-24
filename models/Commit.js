/**
 * New node file
 */
var tbConfig = require('../config/config.json').tbConfig.commit;

module.exports = function(sequelize, DataTypes) {

    var Commit = sequelize.define('Commit', {
	version : {
	    type : DataTypes.INTEGER.UNSIGNED,
	    allowNull : false,
	},
	comentario : {
	    type : DataTypes.TEXT,
	    allowNull : true,
	},
    }, {
	classMethods : {
	    associate : function(models) {
			Commit.belongsTo(models.User);
			Commit.belongsTo(models.Repositorio);
			Commit.hasMany(models.CommitArchivo);
	    }
	},
	indexes : [{
		unique : true,
		fields : ['repositorioId', 'version']
	}],
	freezeTableName : true,
	tableName : tbConfig.tabla,
	charset : tbConfig.charset,
	createdAt : 'fecha_creado',
	updateAt : false
    });

    return Commit;
};